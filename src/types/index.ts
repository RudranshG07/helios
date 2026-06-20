export type Mode = "paper" | "testnet" | "mainnet";
export type Regime = "risk-on" | "neutral" | "risk-off";
export type Side = "buy" | "sell";
export type Verdict = "OK" | "WARN" | "BREAKER" | "KILL" | "ENGINE_DOWN";

export interface RiskConfig {
  maxExposurePct: number;
  maxPositionPctPerToken: number;
  maxTradeSizeUsd: number;
  hardDrawdownStopPct: number;
  drawdownWarnPct: number;
  minTradesTarget: number;
  minTradesPerDay: number;
  minLiquidityUsd: number;
  maxSlippageBps: number;
  perTradeCostBps: number;
  maxDailyNotionalUsd: number;
  cooldownMinutes: number;
  trendThreshold: number;
  minConviction: number;
  rebalanceBandPct: number;
  allowedTokens: string[];
  stableAsset: string;
  killSwitch: boolean;
}

export interface DecideContext {
  secondsSinceLastTrade: number;
  volScale: number;
}

export interface ChainConfig {
  chainId: number;
  twakChain: string;
  erc8004Chain: string;
  rpcUrls: string[];
  confirmations: number;
  gasBumpPct: number;
  txTimeoutSeconds: number;
}

export interface Config {
  mode: Mode;
  tickIntervalSeconds: number;
  staleMarketSeconds: number;
  startingCapitalUsd: number;
  recordTradesOnChain: boolean;
  reputationThrottleSeconds: number;
  risk: RiskConfig;
  chain: ChainConfig;
  riskEngine: { url: string; timeoutMs: number; failClosed: boolean };
  ops: { healthPort: number; heartbeatSeconds: number; alertWebhookUrl: string };
  watchdog: { healthUrl: string; pollSeconds: number; stallSeconds: number; restartCommand: string };
}

export interface Position {
  token: string;
  qtyBase: number;
  entryPxUsd: number;
  markPxUsd: number;
}

export interface Portfolio {
  equityUsd: number;
  highWaterUsd: number;
  tradeCount: number;
  positions: Position[];
}

export interface MarketState {
  ts: number;
  regime: Regime;
  riskFlags: string[];
  liquidityUsd: number;
  token: string;
  technicals: { momentum: number; trend: number };
  crossAssetPressure: number;
  price: number;
  sentiment: number;
  rationale: string;
  stale: boolean;
}

export interface Trade {
  token: string;
  side: Side;
  sizeUsd: number;
  maxSlippageBps: number;
  liquidityUsd: number;
  clientOrderId: string;
}

export interface TradePlan {
  targetExposurePct: number;
  trades: Trade[];
}

export interface EvalRequest {
  nowUnix: number;
  portfolio: Portfolio;
  plan: TradePlan;
  config: RiskConfig;
  lastTrade: Record<string, number>;
  dailyNotionalUsd: number;
}

export interface Rejection {
  trade: Trade;
  reason: string;
}

export interface EvalResponse {
  verdict: Verdict;
  drawdownPct: number;
  flatten: boolean;
  approved: Trade[];
  rejected: Rejection[];
  notes: string[];
}

export interface LedgerEntry {
  ts: number;
  regime: Regime;
  action: string;
  sizeUsd: number;
  realizedPnl: number;
  rationale: string;
  stateHash: string;
}
