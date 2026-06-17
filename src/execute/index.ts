import type { Config, Trade } from "../types/index.ts";
import type { Fill } from "../state/store.ts";

export interface Signer {
  name(): string;
  signAndBroadcast(unsignedTx: unknown): Promise<string>;
}

export interface Executor {
  execute(trade: Trade): Promise<Fill>;
}

export function createExecutor(cfg: Config): Executor {
  if (cfg.mode === "paper") return new PaperExecutor(cfg);
  throw new Error("live executor not implemented — resolve-first: PancakeSwap router + signer wiring");
}

export function createSigner(_cfg: Config): Signer {
  return new TwakSigner();
}

class PaperExecutor implements Executor {
  private readonly cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  async execute(trade: Trade): Promise<Fill> {
    const cost = trade.sizeUsd * (this.cfg.risk.perTradeCostBps / 10_000);
    return { txHash: `paper:${trade.clientOrderId}`, filledUsd: round2(trade.sizeUsd - cost) };
  }
}

class TwakSigner implements Signer {
  name(): string {
    return "twak-cli";
  }

  async signAndBroadcast(): Promise<string> {
    throw new Error("TwakSigner not implemented — resolve-first: prove TWAK CLI signs+broadcasts a BSC testnet swap");
  }
}

export class EthersSigner implements Signer {
  name(): string {
    return "ethers-native";
  }

  async signAndBroadcast(): Promise<string> {
    throw new Error("EthersSigner fallback not implemented — wire after chain layer lands");
  }
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
