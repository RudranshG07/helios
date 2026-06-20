import type { Config, LedgerEntry } from "../types/index.ts";
import type { Store } from "../state/store.ts";
import { riskPolicyHash } from "../util/policy.ts";
import { log } from "../util/log.ts";
import { registerIdentity, setMetadata } from "./erc8004.ts";

export interface Recorder {
  record(entry: LedgerEntry): Promise<void>;
  publishReputation(metrics: Record<string, number>): Promise<void>;
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

  async publishReputation(metrics: Record<string, number>): Promise<void> {
    log("reputation", metrics);
  }
}

class Erc8004Recorder implements Recorder {
  private readonly cfg: Config;
  private readonly store: Store;
  private readonly policyHash: string;
  private lastReputationUnix = 0;

  constructor(cfg: Config, store: Store) {
    this.cfg = cfg;
    this.store = store;
    this.policyHash = riskPolicyHash(cfg.risk);
  }

  async record(entry: LedgerEntry): Promise<void> {
    this.store.appendLedger(entry);
    if (!this.cfg.recordTradesOnChain) return; // gas-saving: keep full ledger off-chain
    const agentId = await this.ensureIdentity();
    const why = (entry.rationale ?? "").replace(/\|/g, "/").slice(0, 80);
    const value = `${entry.action}|${entry.sizeUsd}|${entry.realizedPnl}|${why}|${entry.stateHash}`;
    await setMetadata(agentId, `t:${entry.ts}`, value, this.cfg.chain.erc8004Chain, process.env.TWAK_WALLET_PASSWORD);
  }

  async publishReputation(metrics: Record<string, number>): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    if (now - this.lastReputationUnix < this.cfg.reputationThrottleSeconds) return;
    this.lastReputationUnix = now;

    const agentId = await this.ensureIdentity();
    await setMetadata(agentId, "reputation", JSON.stringify(metrics), this.cfg.chain.erc8004Chain, process.env.TWAK_WALLET_PASSWORD);
  }

  private async ensureIdentity(): Promise<string> {
    const existing = this.store.getMeta("agentId");
    if (existing) return existing;

    const uri = `data:application/json,${encodeURIComponent(JSON.stringify({ name: "Helios", kind: "trading-agent", riskPolicy: this.policyHash }))}`;
    const agentId = await registerIdentity(uri, this.cfg.chain.erc8004Chain, process.env.TWAK_WALLET_PASSWORD);
    this.store.setMeta("agentId", agentId);
    await setMetadata(agentId, "risk-policy", this.policyHash, this.cfg.chain.erc8004Chain, process.env.TWAK_WALLET_PASSWORD);
    return agentId;
  }
}
