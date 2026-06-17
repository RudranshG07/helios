import type { MarketState, Portfolio, RiskConfig, Trade, TradePlan } from "../types/index.ts";

export function decide(state: MarketState, portfolio: Portfolio, cfg: RiskConfig): TradePlan {
  if (state.stale || state.riskFlags.length > 0) return flatten(state, portfolio, cfg);

  const target = targetExposure(state, cfg);
  return planTowardTarget(target, state, portfolio, cfg);
}

function targetExposure(state: MarketState, cfg: RiskConfig): number {
  switch (state.regime) {
    case "risk-off":
      return 0;
    case "neutral":
      return 0.2 * cfg.maxExposurePct;
    case "risk-on": {
      const strength = clamp((state.technicals.momentum + state.technicals.trend + state.crossAssetPressure) / 3, 0, 1);
      return strength * cfg.maxExposurePct;
    }
  }
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

function flatten(state: MarketState, portfolio: Portfolio, cfg: RiskConfig): TradePlan {
  const trades = portfolio.positions
    .filter((p) => p.token !== cfg.stableAsset && p.qtyBase > 0)
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
