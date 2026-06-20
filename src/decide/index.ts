import type { DecideContext, MarketState, Portfolio, RiskConfig, Trade, TradePlan } from "../types/index.ts";

export function decide(states: MarketState[], portfolio: Portfolio, cfg: RiskConfig, ctx: DecideContext): TradePlan {
  const fresh = states.filter((s) => !s.stale);
  const ranked = fresh.map((s) => ({ s, c: conviction(s, cfg) })).sort((a, b) => b.c - a.c);
  const best = ranked[0];
  const riskOff = fresh.some((s) => s.riskFlags.length > 0);

  let targetToken: string | null = null;
  let targetExposure = 0;
  if (best && best.c >= cfg.minConviction && !riskOff) {
    targetToken = best.s.token;
    targetExposure = clamp(best.c * cfg.maxExposurePct * ctx.volScale, 0, cfg.maxExposurePct);
  }

  const stateByToken = new Map(fresh.map((s) => [s.token, s]));
  const trades: Trade[] = [];

  // rotate out of anything that isn't the target
  for (const p of portfolio.positions) {
    if (p.token === cfg.stableAsset) continue;
    const value = p.qtyBase * p.markPxUsd;
    if (value >= 1 && p.token !== targetToken) {
      trades.push(mkTrade(p.token, "sell", value, stateByToken.get(p.token), cfg));
    }
  }

  // move the target toward its exposure
  if (targetToken) {
    const current = heldValue(portfolio, targetToken);
    const delta = targetExposure * portfolio.equityUsd - current;
    if (Math.abs(delta) >= cfg.rebalanceBandPct * portfolio.equityUsd) {
      const size = Math.min(Math.abs(delta), cfg.maxTradeSizeUsd);
      if (size >= 1) trades.push(mkTrade(targetToken, delta > 0 ? "buy" : "sell", size, stateByToken.get(targetToken), cfg));
    } else if (trades.length === 0) {
      const nudge = turnoverNudge(stateByToken.get(targetToken)!, portfolio, cfg, ctx.secondsSinceLastTrade);
      if (nudge) trades.push(nudge);
    }
  }

  return { targetExposurePct: targetExposure, trades };
}

export function rankByConviction(states: MarketState[], cfg: RiskConfig): MarketState[] {
  return states
    .filter((s) => !s.stale)
    .map((s) => ({ s, c: conviction(s, cfg) }))
    .sort((a, b) => b.c - a.c)
    .map((x) => x.s);
}

export function flattenPlan(portfolio: Portfolio, cfg: RiskConfig): TradePlan {
  const trades = portfolio.positions
    .filter((p) => p.token !== cfg.stableAsset && p.qtyBase * p.markPxUsd >= 1)
    .map<Trade>((p) => mkTrade(p.token, "sell", p.qtyBase * p.markPxUsd, undefined, cfg));
  return { targetExposurePct: 0, trades };
}

function conviction(state: MarketState, cfg: RiskConfig): number {
  const t = state.technicals;
  const trending = Math.abs(t.trend) >= cfg.trendThreshold;
  let score = trending
    ? 0.5 * t.trend + 0.3 * t.momentum + 0.2 * state.crossAssetPressure
    : -0.6 * t.momentum + 0.2 * state.crossAssetPressure;
  score += 0.15 * (state.sentiment ?? 0);
  if (state.regime === "risk-on") score += 0.1;
  if (state.regime === "risk-off") score = Math.min(score, 0);
  return clamp(score, -1, 1);
}

function turnoverNudge(state: MarketState, portfolio: Portfolio, cfg: RiskConfig, secondsSinceLastTrade: number): Trade | null {
  if (cfg.minTradesPerDay <= 0 || portfolio.equityUsd <= 0) return null;
  if (secondsSinceLastTrade < 86_400 / cfg.minTradesPerDay) return null;
  const size = Math.min(cfg.maxTradeSizeUsd, Math.max(2, 0.05 * portfolio.equityUsd));
  if (size < 1) return null;
  const exposure = nonStableExposure(portfolio, cfg.stableAsset);
  if (exposure + size <= cfg.maxExposurePct * portfolio.equityUsd) return mkTrade(state.token, "buy", size, state, cfg);
  if (heldValue(portfolio, state.token) >= size) return mkTrade(state.token, "sell", size, state, cfg);
  return null;
}

function mkTrade(token: string, side: "buy" | "sell", sizeUsd: number, state: MarketState | undefined, cfg: RiskConfig): Trade {
  const ts = state?.ts ?? Math.floor(Date.now() / 1000);
  return {
    token,
    side,
    sizeUsd: round2(sizeUsd),
    maxSlippageBps: cfg.maxSlippageBps,
    liquidityUsd: state?.liquidityUsd ?? cfg.minLiquidityUsd * 2,
    clientOrderId: `${token}-${side}-${ts}`,
  };
}

function heldValue(portfolio: Portfolio, token: string): number {
  return portfolio.positions.filter((p) => p.token === token).reduce((s, p) => s + p.qtyBase * p.markPxUsd, 0);
}

function nonStableExposure(portfolio: Portfolio, stable: string): number {
  return portfolio.positions.filter((p) => p.token !== stable).reduce((s, p) => s + p.qtyBase * p.markPxUsd, 0);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
