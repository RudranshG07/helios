import { createHash } from "node:crypto";
import { loadConfig } from "./config/index.ts";
import { Store } from "./state/store.ts";
import { createSensor, type Sensor } from "./sense/index.ts";
import { decide, flattenPlan } from "./decide/index.ts";
import { analyze } from "./analyst/claude.ts";
import { evaluate } from "./risk/client.ts";
import { createExecutor, type Executor } from "./execute/index.ts";
import { createRecorder, type Recorder } from "./record/index.ts";
import { OpsServer } from "./ops/health.ts";
import { Alerter } from "./ops/alerts.ts";
import { riskPolicyHash } from "./util/policy.ts";
import { errorLog, log } from "./util/log.ts";
import type { Config, EvalRequest, MarketState } from "./types/index.ts";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const store = new Store(process.env.HELIOS_DB ?? "data/helios.db", cfg.risk.stableAsset);
  store.initialize(cfg.startingCapitalUsd);

  const sensor = createSensor(cfg);
  const executor = createExecutor(cfg);
  const recorder = createRecorder(cfg, store);
  const ops = new OpsServer(store, cfg.ops.healthPort, riskPolicyHash(cfg.risk));
  ops.start();
  const alerter = new Alerter(process.env.ALERT_WEBHOOK_URL ?? cfg.ops.alertWebhookUrl);

  log("starting", { mode: cfg.mode, healthPort: cfg.ops.healthPort, tick: cfg.tickIntervalSeconds });
  await alerter.send("startup", `started in ${cfg.mode} mode`);

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
  const state = await sensor.read();
  const stale = state.stale || now - state.ts > cfg.staleMarketSeconds;
  const primary = cfg.risk.allowedTokens.find((t) => t !== cfg.risk.stableAsset)!;

  if (stale) {
    log("tick", { stale: true, regime: state.regime });
    ops.beat({ stale: true, tradeCount: store.getPortfolio().tradeCount });
    await alerter.send("stale", "market data is stale; holding");
    return;
  }

  const analysis = await analyze(state);
  state.sentiment = analysis.sentiment;
  state.rationale = analysis.rationale;
  if (analysis.rationale) store.setMeta("lastRationale", analysis.rationale);

  store.markPrices({ [primary]: state.price });
  store.updateVolatility(state.price);
  store.refreshHighWater();
  store.updateMaxDrawdown();
  const portfolio = store.getPortfolio();

  const lastFill = store.lastFillUnix();
  const secondsSinceLastTrade = lastFill > 0 ? now - lastFill : Number.MAX_SAFE_INTEGER;
  const volScale = store.volScale();
  const risk = store.killActive() ? { ...cfg.risk, killSwitch: true } : cfg.risk;
  const plan = decide(state, portfolio, risk, { secondsSinceLastTrade, volScale });
  const req: EvalRequest = {
    nowUnix: now,
    portfolio,
    plan,
    config: risk,
    lastTrade: store.lastTradeMap(),
  };
  const verdict = await evaluate(cfg, req);

  if (verdict.verdict === "BREAKER" || verdict.verdict === "KILL") {
    await alerter.send(`breaker-${verdict.verdict}`, `${verdict.verdict} active at drawdown ${(verdict.drawdownPct * 100).toFixed(2)}% — flattening`);
  }
  if (verdict.verdict === "ENGINE_DOWN") {
    await alerter.send("engine-down", "risk engine unreachable — no trades executed");
  }

  const toExecute = verdict.flatten ? flattenPlan(state, portfolio, risk).trades : verdict.approved;
  for (const trade of toExecute) {
    if (store.alreadyFilled(trade.clientOrderId)) continue;
    try {
      const fill = await executor.execute(trade, state.price);
      const realizedPnl = store.applyFill(fill, now, trade.clientOrderId);
      await recorder.record({
        ts: now,
        regime: state.regime,
        action: `${trade.side} ${trade.token}`,
        sizeUsd: fill.notionalUsd,
        realizedPnl,
        rationale: state.rationale,
        stateHash: hashState(state),
      });
    } catch (err) {
      errorLog("trade failed", err, { clientOrderId: trade.clientOrderId });
      await alerter.send("trade-error", `trade ${trade.clientOrderId} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  store.markPrices({ [primary]: state.price });
  store.refreshHighWater();
  store.updateMaxDrawdown();
  const after = store.getPortfolio();

  ops.setSignal({
    ts: state.ts,
    regime: state.regime,
    technicals: state.technicals,
    crossAssetPressure: state.crossAssetPressure,
    price: state.price,
    targetExposurePct: round4(plan.targetExposurePct),
  });
  await recorder.publishReputation(store.metrics() as unknown as Record<string, number>);

  log("tick", {
    regime: state.regime,
    verdict: verdict.verdict,
    sentiment: round4(state.sentiment),
    drawdownPct: round4(verdict.drawdownPct),
    target: round4(plan.targetExposurePct),
    equityUsd: round2(after.equityUsd),
    approved: verdict.approved.length,
    rejected: verdict.rejected.length,
    tradeCount: after.tradeCount,
  });
  ops.beat({
    regime: state.regime,
    verdict: verdict.verdict,
    sentiment: round4(state.sentiment),
    rationale: state.rationale,
    equityUsd: round2(after.equityUsd),
    drawdownPct: round4(verdict.drawdownPct),
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
