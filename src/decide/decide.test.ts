import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "./index.ts";
import type { MarketState, Portfolio, RiskConfig } from "../types/index.ts";

const cfg: RiskConfig = {
  maxExposurePct: 0.8,
  maxPositionPctPerToken: 0.25,
  maxTradeSizeUsd: 250,
  hardDrawdownStopPct: 0.25,
  drawdownWarnPct: 0.18,
  minTradesTarget: 30,
  minTradesPerDay: 5,
  minLiquidityUsd: 250000,
  maxSlippageBps: 80,
  perTradeCostBps: 30,
  cooldownMinutes: 15,
  allowedTokens: ["WBNB", "USDT"],
  stableAsset: "USDT",
  killSwitch: false,
};

function state(over: Partial<MarketState> = {}): MarketState {
  return {
    ts: 1000,
    regime: "neutral",
    riskFlags: [],
    liquidityUsd: 5_000_000,
    technicals: { momentum: 0.5, trend: 0.5 },
    crossAssetPressure: 0.5,
    price: 600,
    stale: false,
    ...over,
  };
}

const flat: Portfolio = {
  equityUsd: 1000,
  highWaterUsd: 1000,
  tradeCount: 0,
  positions: [{ token: "USDT", qtyBase: 1000, entryPxUsd: 1, markPxUsd: 1 }],
};

test("risk-on buys the primary toward target", () => {
  const plan = decide(state({ regime: "risk-on", technicals: { momentum: 1, trend: 1 }, crossAssetPressure: 1 }), flat, cfg, 0);
  assert.equal(plan.trades.length, 1);
  assert.equal(plan.trades[0]?.side, "buy");
  assert.equal(plan.trades[0]?.token, "WBNB");
});

test("risk-off flattens an open position", () => {
  const pf: Portfolio = {
    equityUsd: 1000,
    highWaterUsd: 1000,
    tradeCount: 1,
    positions: [
      { token: "USDT", qtyBase: 800, entryPxUsd: 1, markPxUsd: 1 },
      { token: "WBNB", qtyBase: 200 / 600, entryPxUsd: 600, markPxUsd: 600 },
    ],
  };
  const plan = decide(state({ regime: "risk-off" }), pf, cfg, 0);
  assert.equal(plan.targetExposurePct, 0);
  assert.ok(plan.trades.some((t) => t.side === "sell" && t.token === "WBNB"));
});

test("stale market forces a flatten plan", () => {
  const plan = decide(state({ stale: true }), flat, cfg, 0);
  assert.equal(plan.targetExposurePct, 0);
});

test("turnover nudge fires only when idle past the pace interval", () => {
  const atTarget: Portfolio = {
    equityUsd: 1000,
    highWaterUsd: 1000,
    tradeCount: 0,
    positions: [
      { token: "USDT", qtyBase: 840, entryPxUsd: 1, markPxUsd: 1 },
      { token: "WBNB", qtyBase: 160 / 600, entryPxUsd: 600, markPxUsd: 600 },
    ],
  };
  const recent = decide(state({ regime: "neutral" }), atTarget, cfg, 0);
  const idle = decide(state({ regime: "neutral" }), atTarget, cfg, 1_000_000_000);
  assert.equal(recent.trades.length, 0);
  assert.equal(idle.trades.length, 1);
});
