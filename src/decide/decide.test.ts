import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, flattenPlan, rankByConviction } from "./index.ts";
import type { DecideContext, MarketState, Portfolio, RiskConfig } from "../types/index.ts";

const cfg: RiskConfig = {
  maxExposurePct: 0.8,
  maxPositionPctPerToken: 0.85,
  maxTradeSizeUsd: 15,
  hardDrawdownStopPct: 0.15,
  drawdownWarnPct: 0.1,
  minTradesTarget: 7,
  minTradesPerDay: 1,
  minLiquidityUsd: 100000,
  maxSlippageBps: 100,
  perTradeCostBps: 30,
  maxDailyNotionalUsd: 60,
  cooldownMinutes: 60,
  trendThreshold: 0.3,
  minConviction: 0.4,
  rebalanceBandPct: 0.08,
  allowedTokens: ["ETH", "CAKE", "XRP", "LINK", "UNI", "USDT"],
  stableAsset: "USDT",
  killSwitch: false,
};

function state(token: string, over: Partial<MarketState> = {}): MarketState {
  return {
    ts: 1000,
    token,
    regime: "neutral",
    riskFlags: [],
    liquidityUsd: 5_000_000,
    technicals: { momentum: 0, trend: 0 },
    crossAssetPressure: 0,
    price: 2000,
    sentiment: 0,
    rationale: "",
    stale: false,
    ...over,
  };
}

function ctx(secondsSinceLastTrade = 0, volScale = 1): DecideContext {
  return { secondsSinceLastTrade, volScale };
}

const flat: Portfolio = { equityUsd: 100, highWaterUsd: 100, tradeCount: 0, positions: [{ token: "USDT", qtyBase: 100, entryPxUsd: 1, markPxUsd: 1 }] };

const strong = (token: string) => state(token, { regime: "risk-on", technicals: { momentum: 1, trend: 1 }, crossAssetPressure: 1 });

test("rotates into the strongest token", () => {
  const states = [strong("LINK"), state("ETH"), state("CAKE")];
  const plan = decide(states, flat, cfg, ctx());
  assert.equal(plan.trades.length, 1);
  assert.equal(plan.trades[0]?.side, "buy");
  assert.equal(plan.trades[0]?.token, "LINK");
});

test("ranks tokens by conviction", () => {
  const ranked = rankByConviction([state("ETH"), strong("XRP"), state("CAKE")], cfg);
  assert.equal(ranked[0]?.token, "XRP");
});

test("below minConviction stays in stable (no buy)", () => {
  const states = [state("ETH", { technicals: { momentum: 0, trend: 0.1 } }), state("CAKE", { technicals: { momentum: 0.05, trend: 0 } })];
  const plan = decide(states, flat, cfg, ctx(0));
  assert.equal(plan.trades.length, 0);
  assert.equal(plan.targetExposurePct, 0);
});

test("rotates out of a held token that weakened", () => {
  const pf: Portfolio = {
    equityUsd: 100,
    highWaterUsd: 100,
    tradeCount: 1,
    positions: [
      { token: "USDT", qtyBase: 50, entryPxUsd: 1, markPxUsd: 1 },
      { token: "ETH", qtyBase: 50 / 2000, entryPxUsd: 2000, markPxUsd: 2000 },
    ],
  };
  const plan = decide([state("ETH"), state("CAKE")], pf, cfg, ctx(0));
  assert.ok(plan.trades.some((t) => t.side === "sell" && t.token === "ETH"));
});

test("flattenPlan sells every non-stable holding", () => {
  const pf: Portfolio = {
    equityUsd: 100,
    highWaterUsd: 100,
    tradeCount: 1,
    positions: [
      { token: "USDT", qtyBase: 40, entryPxUsd: 1, markPxUsd: 1 },
      { token: "LINK", qtyBase: 4, entryPxUsd: 15, markPxUsd: 15 },
    ],
  };
  const plan = flattenPlan(pf, cfg);
  assert.equal(plan.targetExposurePct, 0);
  assert.ok(plan.trades.some((t) => t.side === "sell" && t.token === "LINK"));
});
