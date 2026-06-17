import type { Config, LedgerEntry } from "../types/index.ts";
import type { Store } from "../state/store.ts";
import { registerIdentity, setMetadata } from "./erc8004.ts";

export interface Recorder {
  record(entry: LedgerEntry): Promise<void>;
}

export function createRecorder(cfg: Config, store: Store): Recorder {
  return cfg.mode === "paper" ? new LocalRecorder(store) : new Erc8004Recorder(cfg, store);
}

class LocalRecorder implements Recorder {
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async record(entry: LedgerEntry): Promise<void> {
    this.store.appendLedger(entry);
  }
}

class Erc8004Recorder implements Recorder {
  private readonly cfg: Config;
  private readonly store: Store;

  constructor(cfg: Config, store: Store) {
    this.cfg = cfg;
    this.store = store;
  }

  async record(entry: LedgerEntry): Promise<void> {
    this.store.appendLedger(entry);

    const agentId = await this.ensureIdentity();
    const value = `${entry.action}|${entry.sizeUsd}|${entry.realizedPnl}|${entry.stateHash}`;
    await setMetadata(agentId, `t:${entry.ts}`, value, this.cfg.chain.erc8004Chain, process.env.TWAK_WALLET_PASSWORD);
  }

  private async ensureIdentity(): Promise<string> {
    const existing = this.store.getMeta("agentId");
    if (existing) return existing;

    const uri = `data:application/json,${encodeURIComponent(JSON.stringify({ name: "Helios", kind: "trading-agent" }))}`;
    const agentId = await registerIdentity(uri, this.cfg.chain.erc8004Chain, process.env.TWAK_WALLET_PASSWORD);
    this.store.setMeta("agentId", agentId);
    return agentId;
  }
}
