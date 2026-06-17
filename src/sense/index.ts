import type { Config, MarketState, Regime } from "../types/index.ts";

export interface Sensor {
  read(): Promise<MarketState>;
}

export function createSensor(cfg: Config): Sensor {
  return cfg.mode === "paper" ? new MockSensor() : new CmcSensor(cfg);
}

class MockSensor implements Sensor {
  async read(): Promise<MarketState> {
    const regimes: Regime[] = ["risk-on", "neutral", "risk-off"];
    return {
      ts: Math.floor(Date.now() / 1000),
      regime: regimes[Math.floor(Math.random() * regimes.length)],
      riskFlags: [],
      liquidityUsd: 5_000_000,
      technicals: { momentum: Math.random() * 2 - 1, trend: Math.random() * 2 - 1 },
      crossAssetPressure: Math.random() * 2 - 1,
      stale: false,
    };
  }
}

class CmcSensor implements Sensor {
  constructor(private readonly cfg: Config) {}

  async read(): Promise<MarketState> {
    throw new Error("CmcSensor not implemented — resolve-first: map CMC MCP tools to MarketState");
  }
}
