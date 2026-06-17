import type { DecideContext, MarketState, Portfolio, RiskConfig, Trade, TradePlan } from "../types/index.ts";

export function decide(state: MarketState, portfolio: Portfolio, cfg: RiskConfig, ctx: DecideContext): TradePlan {
  if (state.stale || state.riskFlags.length > 0) return flatten(state, portfolio, cfg);

  const target = targetExposure(state, cfg, ctx.volScale);
  const plan = planTowardTarget(target, state, portfolio, cfg);

  if (plan.trades.length === 0) {
    const nudge = turnoverNudge(state, portfolio, cfg, ctx.secondsSinceLastTrade);
    if (nudge) plan.trades.push(nudge);
  }
  return plan;
}

function conviction(state: MarketState, cfg: RiskConfig): number {
  const t = state.technicals;
  const trending = Math.abs(t.trend) >= cfg.trendThreshold;

  let score = trending
    ? 0.5 * t.trend + 0.3 * t.momentum + 0.2 * state.crossAssetPressure
    : -0.6 * t.momentum + 0.2 * state.crossAssetPressure;

  if (state.regime === "risk-on") score += 0.1;
  if (state.regime === "risk-off") score = Math.min(score, 0);
  return clamp(score, -1, 1);
}

function targetExposure(state: MarketState, cfg: RiskConfig, volScale: number): number {
  const base = Math.max(0, conviction(state, cfg)) * cfg.maxExposurePct;
  return clamp(base * volScale, 0, cfg.maxExposurePct);
}

function turnoverNudge(state: MarketState, portfolio: Portfolio, cfg: RiskConfig, secondsSinceLastTrade: number): Trade | null {
  if (cfg.minTradesPerDay <= 0 || portfolio.equityUsd <= 0) return null;
  if (secondsSinceLastTrade < 86_400 / cfg.minTradesPerDay) return null;

  const primary = cfg.allowedTokens.find((t) => t !== cfg.stableAsset)!;
  const exposure = nonStableExposure(portfolio, cfg.stableAsset);
  const size = Math.min(cfg.maxTradeSizeUsd, Math.max(10, 0.02 * portfolio.equityUsd));
  if (size < 1) return null;

  const canBuy = state.regime !== "risk-off" && exposure + size <= cfg.maxExposurePct * portfolio.equityUsd;
  if (canBuy) return nudgeTrade(primary, "buy", size, state, cfg);
  if (exposure >= size) return nudgeTrade(primary, "sell", size, state, cfg);
  return null;
}

function nudgeTrade(token: string, side: "buy" | "sell", sizeUsd: number, state: MarketState, cfg: RiskConfig): Trade {
  return {
    token,
    side,
    sizeUsd: round2(sizeUsd),
    maxSlippageBps: cfg.maxSlippageBps,
    liquidityUsd: state.liquidityUsd,
    clientOrderId: `${token}-nudge-${state.ts}`,
  };
}

function planTowardTarget(target: number, state: MarketState, portfolio: Portfolio, cfg: RiskConfig): TradePlan {
  const primary = cfg.allowedTokens.find((t) => t !== cfg.stableAsset)!;
  const currentExposure = nonStableExposure(portfolio, cfg.stableAsset);
  const delta = target * portfolio.equityUsd - currentExposure;
  const size = Math.min(Math.abs(delta), cfg.maxTradeSizeUsd);

  if (size < 1) return { targetExposurePct: target, trades: [] };

  const side = delta > 0 ? "buy" : "sell";
  const trade: Trade = {
    token: primary,
    side,
    sizeUsd: round2(size),
    maxSlippageBps: cfg.maxSlippageBps,
    liquidityUsd: state.liquidityUsd,
    clientOrderId: `${primary}-${side}-${state.ts}`,
  };
  return { targetExposurePct: target, trades: [trade] };
}

export function flattenPlan(state: MarketState, portfolio: Portfolio, cfg: RiskConfig): TradePlan {
  return flatten(state, portfolio, cfg);
}

function flatten(state: MarketState, portfolio: Portfolio, cfg: RiskConfig): TradePlan {
  const trades = portfolio.positions
    .filter((p) => p.token !== cfg.stableAsset && p.qtyBase * p.markPxUsd >= 1)
    .map<Trade>((p) => ({
      token: p.token,
      side: "sell",
      sizeUsd: round2(p.qtyBase * p.markPxUsd),
      maxSlippageBps: cfg.maxSlippageBps,
      liquidityUsd: state.liquidityUsd,
      clientOrderId: `${p.token}-flat-${state.ts}`,
    }));
  return { targetExposurePct: 0, trades };
}

function nonStableExposure(portfolio: Portfolio, stable: string): number {
  return portfolio.positions
    .filter((p) => p.token !== stable)
    .reduce((sum, p) => sum + p.qtyBase * p.markPxUsd, 0);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
