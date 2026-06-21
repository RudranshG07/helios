import { createHash } from "node:crypto";
import { loadConfig } from "./config/index.ts";
import { Store } from "./state/store.ts";
import { createSensor, type Sensor } from "./sense/index.ts";
import { decide, flattenPlan, rankByConviction } from "./decide/index.ts";
import { analyze } from "./analyst/claude.ts";
import { evaluate } from "./risk/client.ts";
import { createExecutor, type Executor } from "./execute/index.ts";
import { createRecorder, type Recorder } from "./record/index.ts";
import { OpsServer } from "./ops/health.ts";
import { Alerter } from "./ops/alerts.ts";
import { riskPolicyHash } from "./util/policy.ts";
import { paidCmcCall } from "./x402/cmc.ts";
import { errorLog, log } from "./util/log.ts";
import type { Config, EvalRequest, MarketState } from "./types/index.ts";

async function readOnchainStableUsd(cfg: Config): Promise<number> {
  const address = process.env.TWAK_WALLET_ADDRESS;
  if (!address) return 0;
  const rpc = cfg.chain.rpcUrls[0];
  if (!rpc) return 0;
  try {
    const { JsonRpcProvider, Contract } = await import("ethers");
    const { STABLE } = await import("./universe.ts");
    const provider = new JsonRpcProvider(rpc);
    const erc20 = new Contract(STABLE.address, ["function balanceOf(address) view returns (uint256)"], provider);
    const raw: bigint = await erc20.balanceOf(address);
    const usd = Number(raw) / 10 ** STABLE.decimals;
    log("seed", { source: "onchain", stable: STABLE.symbol, usd });
    return usd;
  } catch (err) {
    errorLog("seed-failed", err);
    return 0;
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const store = new Store(process.env.HELIOS_DB ?? "data/helios.db", cfg.risk.stableAsset);
  const seedUsd = cfg.mode === "paper" ? cfg.startingCapitalUsd : await readOnchainStableUsd(cfg);
  store.initialize(seedUsd);
  if (cfg.mode !== "paper") store.reseedStable(seedUsd);

  const sensor = createSensor(cfg);
  const executor = createExecutor(cfg);
  const recorder = createRecorder(cfg, store);
  const ops = new OpsServer(store, cfg.ops.healthPort, riskPolicyHash(cfg.risk));
  ops.start();
  const alerter = new Alerter(process.env.ALERT_WEBHOOK_URL ?? cfg.ops.alertWebhookUrl);

  log("starting", { mode: cfg.mode, healthPort: cfg.ops.healthPort, tick: cfg.tickIntervalSeconds });
  await alerter.send("startup", `started in ${cfg.mode} mode`);

  const x402 = await paidCmcCall();
  log("x402", { ok: x402.ok, settled: x402.settled ?? false, note: x402.note });

  let running = true;
  const stop = () => {
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (running) {
    try {
      await tick(cfg, store, sensor, executor, recorder, ops, alerter);
    } catch (err) {
      errorLog("tick failed", err);
      await alerter.send("tick-error", `tick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(cfg.tickIntervalSeconds * 1000, () => !running);
  }

  ops.stop();
  log("stopped", {});
}

async function tick(
  cfg: Config,
  store: Store,
  sensor: Sensor,
  executor: Executor,
  recorder: Recorder,
  ops: OpsServer,
  alerter: Alerter,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const states = (await sensor.read()).filter((s) => !s.stale && now - s.ts <= cfg.staleMarketSeconds);

  if (states.length === 0) {
    log("tick", { stale: true });
    ops.beat({ stale: true, tradeCount: store.getPortfolio().tradeCount });
    await alerter.send("stale", "market data is stale; holding");
    return;
  }

  const priceByToken = Object.fromEntries(states.map((s) => [s.token, s.price]));
  store.markPrices(priceByToken);
  store.refreshHighWater();
  store.updateMaxDrawdown();
  const portfolio = store.getPortfolio();

  // AI analyst on the strongest deterministic candidate (one Claude call/tick)
  const best = rankByConviction(states, cfg.risk)[0];
  if (best) {
    const analysis = await analyze(best);
    best.sentiment = analysis.sentiment;
    best.rationale = analysis.rationale;
    if (analysis.rationale) store.setMeta("lastRationale", `${best.token}: ${analysis.rationale}`);
  }

  const lastFill = store.lastFillUnix();
  const secondsSinceLastTrade = lastFill > 0 ? now - lastFill : Number.MAX_SAFE_INTEGER;
  const risk = store.killActive() ? { ...cfg.risk, killSwitch: true } : cfg.risk;
  const plan = decide(states, portfolio, risk, { secondsSinceLastTrade, volScale: 1 });
  const req: EvalRequest = {
    nowUnix: now,
    portfolio,
    plan,
    config: risk,
    lastTrade: store.lastTradeMap(),
    dailyNotionalUsd: store.dailyNotionalUsd(now),
  };
  const verdict = await evaluate(cfg, req);

  if (verdict.verdict === "BREAKER" || verdict.verdict === "KILL") {
    await alerter.send(`breaker-${verdict.verdict}`, `${verdict.verdict} active at drawdown ${(verdict.drawdownPct * 100).toFixed(2)}% — flattening`);
  }
  if (verdict.verdict === "ENGINE_DOWN") {
    await alerter.send("engine-down", "risk engine unreachable — no trades executed");
  }

  const toExecute = verdict.flatten ? flattenPlan(portfolio, risk).trades : verdict.approved;
  for (const trade of toExecute) {
    if (store.alreadyFilled(trade.clientOrderId)) continue;
    try {
      const fill = await executor.execute(trade, priceByToken[trade.token] ?? 0);
      const realizedPnl = store.applyFill(fill, now, trade.clientOrderId);
      await recorder.record({
        ts: now,
        regime: best?.regime ?? "neutral",
        action: `${trade.side} ${trade.token}`,
        sizeUsd: fill.notionalUsd,
        realizedPnl,
        rationale: best?.rationale ?? "",
        stateHash: hashState(best ?? states[0]),
      });
    } catch (err) {
      errorLog("trade failed", err, { clientOrderId: trade.clientOrderId });
      await alerter.send("trade-error", `trade ${trade.clientOrderId} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  store.markPrices(priceByToken);
  store.refreshHighWater();
  store.updateMaxDrawdown();
  const after = store.getPortfolio();
  store.recordEquityPoint(now, after.equityUsd);
  const held = after.positions.filter((p) => p.token !== cfg.risk.stableAsset && p.qtyBase * p.markPxUsd >= 1).map((p) => p.token);

  ops.setSignal({
    ts: now,
    bestToken: best?.token,
    regime: best?.regime,
    targetExposurePct: round4(plan.targetExposurePct),
    holding: held,
  });
  await recorder.publishReputation(store.metrics() as unknown as Record<string, number>);

  log("tick", {
    best: best?.token,
    regime: best?.regime,
    verdict: verdict.verdict,
    sentiment: round4(best?.sentiment ?? 0),
    drawdownPct: round4(verdict.drawdownPct),
    target: round4(plan.targetExposurePct),
    equityUsd: round2(after.equityUsd),
    holding: held.join(",") || "stable",
    approved: verdict.approved.length,
    rejected: verdict.rejected.length,
    tradeCount: after.tradeCount,
  });
  ops.beat({
    bestToken: best?.token,
    regime: best?.regime,
    verdict: verdict.verdict,
    sentiment: round4(best?.sentiment ?? 0),
    rationale: best?.rationale ?? "",
    equityUsd: round2(after.equityUsd),
    drawdownPct: round4(verdict.drawdownPct),
    holding: held,
    tradeCount: after.tradeCount,
  });
}

function hashState(state: MarketState): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

function sleep(ms: number, cancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const step = 250;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += step;
      if (elapsed >= ms || cancelled()) {
        clearInterval(timer);
        resolve();
      }
    }, step);
  });
}

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

main().catch((err) => {
  errorLog("fatal", err);
  process.exit(1);
});
