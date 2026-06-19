import type { Config, MarketState, Regime } from "../types/index.ts";
import { callTool } from "./cmc.ts";

const BNB_ID = "1839";

export interface Sensor {
  read(): Promise<MarketState>;
}

export function createSensor(cfg: Config): Sensor {
  return cfg.mode === "paper" ? new MockSensor() : new CmcSensor(cfg);
}

export class MockSensor implements Sensor {
  async read(): Promise<MarketState> {
    const regimes: Regime[] = ["risk-on", "neutral", "risk-off"];
    return {
      ts: Math.floor(Date.now() / 1000),
      regime: regimes[Math.floor(Math.random() * regimes.length)],
      riskFlags: [],
      liquidityUsd: 5_000_000,
      technicals: { momentum: Math.random() * 2 - 1, trend: Math.random() * 2 - 1 },
      crossAssetPressure: Math.random() * 2 - 1,
      price: 600 + (Math.random() * 20 - 10),
      sentiment: 0,
      rationale: "",
      stale: false,
    };
  }
}

export class CmcSensor implements Sensor {
  private readonly cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  async read(): Promise<MarketState> {
    const [quotesRaw, taRaw, globalRaw, derivRaw] = await Promise.all([
      callTool("get_crypto_quotes_latest", { id: BNB_ID }),
      callTool("get_crypto_technical_analysis", { id: BNB_ID }),
      callTool("get_global_metrics_latest", {}),
      callTool("get_global_crypto_derivatives_metrics", {}),
    ]);

    const quote = (Array.isArray(quotesRaw) ? quotesRaw[0] : quotesRaw) as Record<string, unknown>;
    const ta = taRaw as Record<string, Record<string, unknown>>;
    const global = globalRaw as Record<string, Record<string, unknown>>;
    const deriv = derivRaw as Record<string, Record<string, unknown>>;

    const price = num(quote.price);
    const volume24h = num(quote.volume_24h);
    const change7d = num(quote.percent_change_7d);

    const ma = ta.moving_averages ?? {};
    const ema7 = num(ma.exponential_moving_average_7_day);
    const ema30 = num(ma.exponential_moving_average_30_day);
    const rsi14 = num((ta.rsi ?? {}).rsi14);
    const macdHistogram = num((ta.macd ?? {}).histogram);

    const fearGreed = num(asRecord(global.fear_greed?.current).index);
    const dominanceNow = pct(asRecord(global.dominance?.btc).current);
    const dominanceWeek = pct(asRecord(asRecord(global.dominance?.btc).history).last_week);
    const oiChange24h = pct(asRecord(deriv.totalOpenInterest).percentage_change_24h);

    const trend = clamp(((ema7 - ema30) / ema30) * 25, -1, 1);
    const momentum = clamp((rsi14 - 50) / 50, -1, 1);
    const crossAssetPressure = clamp(change7d / 20 - (dominanceNow - dominanceWeek) / 5, -1, 1);

    const trendUp = ema7 > ema30;
    const momentumUp = rsi14 > 50 && macdHistogram > 0;
    const regime: Regime =
      trendUp && momentumUp && fearGreed >= 40
        ? "risk-on"
        : (!trendUp && !momentumUp) || fearGreed < 20
          ? "risk-off"
          : "neutral";

    const riskFlags: string[] = [];
    if (fearGreed > 0 && fearGreed <= 15) riskFlags.push("extreme-fear");

    return {
      ts: Math.floor(Date.now() / 1000),
      regime,
      riskFlags,
      liquidityUsd: volume24h,
      technicals: { momentum: round4(momentum), trend: round4(trend) },
      crossAssetPressure: round4(crossAssetPressure),
      price,
      sentiment: 0,
      rationale: "",
      stale: !Number.isFinite(price) || price <= 0,
    };
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v.replace(/,/g, ""));
  return NaN;
}

function pct(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v.replace(/[+%\s,]/g, ""));
  return NaN;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}
