import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "./index.ts";
import type { DecideContext, MarketState, Portfolio, RiskConfig } from "../types/index.ts";

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
  trendThreshold: 0.3,
  rebalanceBandPct: 0.06,
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
    sentiment: 0,
    rationale: "",
    stale: false,
    ...over,
  };
}

function ctx(secondsSinceLastTrade = 0, volScale = 1): DecideContext {
  return { secondsSinceLastTrade, volScale };
}

const flat: Portfolio = {
  equityUsd: 1000,
  highWaterUsd: 1000,
  tradeCount: 0,
  positions: [{ token: "USDT", qtyBase: 1000, entryPxUsd: 1, markPxUsd: 1 }],
};

function withWbnb(usdt: number, wbnbValue: number): Portfolio {
  return {
    equityUsd: usdt + wbnbValue,
    highWaterUsd: usdt + wbnbValue,
    tradeCount: 1,
    positions: [
      { token: "USDT", qtyBase: usdt, entryPxUsd: 1, markPxUsd: 1 },
      { token: "WBNB", qtyBase: wbnbValue / 600, entryPxUsd: 600, markPxUsd: 600 },
    ],
  };
}

test("strong risk-on trend buys the primary", () => {
  const plan = decide(state({ regime: "risk-on", technicals: { momentum: 1, trend: 1 }, crossAssetPressure: 1 }), flat, cfg, ctx());
  assert.equal(plan.trades.length, 1);
  assert.equal(plan.trades[0]?.side, "buy");
  assert.equal(plan.trades[0]?.token, "WBNB");
});

test("risk-off flattens an open position", () => {
  const plan = decide(state({ regime: "risk-off" }), withWbnb(800, 200), cfg, ctx());
  assert.equal(plan.targetExposurePct, 0);
  assert.ok(plan.trades.some((t) => t.side === "sell" && t.token === "WBNB"));
});

test("stale market forces a flatten plan", () => {
  const plan = decide(state({ stale: true }), flat, cfg, ctx());
  assert.equal(plan.targetExposurePct, 0);
});

test("ranging + oversold triggers a mean-reversion buy", () => {
  const plan = decide(state({ regime: "neutral", technicals: { momentum: -0.8, trend: 0.1 }, crossAssetPressure: 0 }), flat, cfg, ctx());
  assert.equal(plan.trades.length, 1);
  assert.equal(plan.trades[0]?.side, "buy");
});

test("ranging + overbought stays flat (no long)", () => {
  const plan = decide(state({ regime: "neutral", technicals: { momentum: 0.8, trend: 0.1 }, crossAssetPressure: 0 }), flat, cfg, ctx(0));
  assert.equal(plan.trades.length, 0);
});

test("volatility scaling shrinks the target exposure", () => {
  const s = state({ regime: "risk-on", technicals: { momentum: 1, trend: 1 }, crossAssetPressure: 1 });
  const full = decide(s, flat, cfg, ctx(0, 1));
  const damped = decide(s, flat, cfg, ctx(0, 0.5));
  assert.ok(full.targetExposurePct > damped.targetExposurePct);
  assert.ok(Math.abs(full.targetExposurePct - 0.8) < 1e-9);
  assert.ok(Math.abs(damped.targetExposurePct - 0.4) < 1e-9);
});

test("turnover nudge fires only when idle past the pace interval", () => {
  const atTarget = withWbnb(600, 400);
  const recent = decide(state({ regime: "neutral" }), atTarget, cfg, ctx(0));
  const idle = decide(state({ regime: "neutral" }), atTarget, cfg, ctx(1_000_000_000));
  assert.equal(recent.trades.length, 0);
  assert.equal(idle.trades.length, 1);
});
