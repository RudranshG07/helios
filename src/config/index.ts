import { readFileSync } from "node:fs";
import type { Config } from "../types/index.ts";

export function loadConfig(path = process.env.HELIOS_CONFIG ?? "config.json"): Config {
  const cfg = JSON.parse(readFileSync(path, "utf8")) as Config;
  validate(cfg);
  return cfg;
}

function validate(c: Config): void {
  const fail = (m: string): never => {
    throw new Error(`config invalid: ${m}`);
  };
  const r = c.risk;

  if (!["paper", "testnet", "mainnet"].includes(c.mode)) fail(`unknown mode ${c.mode}`);
  if (c.tickIntervalSeconds <= 0) fail("tickIntervalSeconds must be positive");
  if (c.startingCapitalUsd <= 0) fail("startingCapitalUsd must be positive");
  if (r.hardDrawdownStopPct <= 0 || r.hardDrawdownStopPct >= 1) fail("hardDrawdownStopPct must be in (0,1)");
  if (r.drawdownWarnPct >= r.hardDrawdownStopPct) fail("drawdownWarnPct must be below hardDrawdownStopPct");
  if (r.maxExposurePct <= 0 || r.maxExposurePct > 1) fail("maxExposurePct must be in (0,1]");
  if (r.maxPositionPctPerToken <= 0 || r.maxPositionPctPerToken > 1) fail("maxPositionPctPerToken must be in (0,1]");
  if (!r.allowedTokens.includes(r.stableAsset)) fail("stableAsset must be in allowedTokens");
  if (r.allowedTokens.filter((t) => t !== r.stableAsset).length === 0) fail("need at least one non-stable allowed token");
  if (r.trendThreshold < 0) fail("trendThreshold must be >= 0");
  if (r.minTradesPerDay < 0) fail("minTradesPerDay must be >= 0");
  if (c.chain.rpcUrls.length === 0) fail("at least one rpc url required");
  if (c.mode !== "paper") {
    if (!c.chain.twakChain) fail("chain.twakChain required for live modes");
    if (!c.chain.erc8004Chain) fail("chain.erc8004Chain required for live modes");
  }
}
