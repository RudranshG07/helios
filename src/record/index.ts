import type { Config, LedgerEntry } from "../types/index.ts";
import type { Store } from "../state/store.ts";

export interface Recorder {
  record(entry: LedgerEntry): Promise<void>;
}

export function createRecorder(cfg: Config, store: Store): Recorder {
  if (cfg.mode === "paper") return new LocalRecorder(store);
  throw new Error("on-chain recorder not implemented — resolve-first: ERC-8004 registry address + ABI");
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
