import type { Config, MarketState, Regime } from "../types/index.ts";
import { UNIVERSE } from "../universe.ts";
import { callTool } from "./cmc.ts";

export interface Sensor {
  read(): Promise<MarketState[]>;
}

export function createSensor(cfg: Config): Sensor {
  return cfg.mode === "paper" ? new MockSensor() : new CmcSensor(cfg);
}

export class MockSensor implements Sensor {
  async read(): Promise<MarketState[]> {
    const ts = Math.floor(Date.now() / 1000);
    const regimes: Regime[] = ["risk-on", "neutral", "risk-off"];
    return UNIVERSE.map((t) => ({
      ts,
      token: t.symbol,
      regime: regimes[Math.floor(Math.random() * regimes.length)],
      riskFlags: [],
      liquidityUsd: 5_000_000,
      technicals: { momentum: Math.random() * 2 - 1, trend: Math.random() * 2 - 1 },
      crossAssetPressure: Math.random() * 2 - 1,
      price: 100 + Math.random() * 1000,
      sentiment: 0,
      rationale: "",
      stale: false,
    }));
  }
}

export class CmcSensor implements Sensor {
  private readonly cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  async read(): Promise<MarketState[]> {
    const ids = UNIVERSE.map((t) => t.cmcId).join(",");
    const [quotesRaw, globalRaw, derivRaw, ...taRaws] = await Promise.all([
      callTool("get_crypto_quotes_latest", { id: ids }),
      callTool("get_global_metrics_latest", {}),
      callTool("get_global_crypto_derivatives_metrics", {}),
      ...UNIVERSE.map((t) => callTool("get_crypto_technical_analysis", { id: String(t.cmcId) })),
    ]);

    const quoteMap = quotesToMap(quotesRaw);
    const global = globalRaw as Record<string, Record<string, unknown>>;
    const deriv = derivRaw as Record<string, Record<string, unknown>>;
    const ts = Math.floor(Date.now() / 1000);

    const fearGreed = num(asRecord(global.fear_greed?.current).index);
    const dominanceNow = pct(asRecord(global.dominance?.btc).current);
    const dominanceWeek = pct(asRecord(asRecord(global.dominance?.btc).history).last_week);
    const riskFlags = fearGreed > 0 && fearGreed <= 15 ? ["extreme-fear"] : [];
    void deriv;

    return UNIVERSE.map((t, i) => {
      const quote = quoteMap.get(String(t.cmcId)) ?? {};
      const ta = (taRaws[i] ?? {}) as Record<string, Record<string, unknown>>;
      const price = num(quote.price);
      const change7d = num(quote.percent_change_7d);

      const ma = ta.moving_averages ?? {};
      const ema7 = num(ma.exponential_moving_average_7_day);
      const ema30 = num(ma.exponential_moving_average_30_day);
      const rsi14 = num((ta.rsi ?? {}).rsi14);
      const macdHistogram = num((ta.macd ?? {}).histogram);

      const trend = clamp(((ema7 - ema30) / ema30) * 25, -1, 1);
      const momentum = clamp((rsi14 - 50) / 50, -1, 1);
      const crossAssetPressure = clamp(change7d / 20 - (dominanceNow - dominanceWeek) / 5, -1, 1);

      const trendUp = ema7 > ema30;
      const momentumUp = rsi14 > 50 && macdHistogram > 0;
      const regime: Regime =
        trendUp && momentumUp && fearGreed >= 40 ? "risk-on" : (!trendUp && !momentumUp) || fearGreed < 20 ? "risk-off" : "neutral";

      return {
        ts,
        token: t.symbol,
        regime,
        riskFlags,
        liquidityUsd: num(quote.volume_24h),
        technicals: { momentum: round4(momentum), trend: round4(trend) },
        crossAssetPressure: round4(crossAssetPressure),
        price,
        sentiment: 0,
        rationale: "",
        stale: !Number.isFinite(price) || price <= 0,
      };
    });
  }
}

function quotesToMap(raw: unknown): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  if (Array.isArray(raw)) {
    for (const o of raw) {
      const obj = o as Record<string, unknown>;
      map.set(String(obj.id), obj);
    }
  } else if (raw && typeof raw === "object" && Array.isArray((raw as { rows?: unknown }).rows)) {
    const q = raw as { headers: string[]; rows: unknown[][] };
    for (const row of q.rows) {
      const obj: Record<string, unknown> = {};
      q.headers.forEach((h, i) => (obj[h] = row[i]));
      map.set(String(obj.id), obj);
    }
  }
  return map;
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
