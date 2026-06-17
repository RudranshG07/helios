import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LedgerEntry, Portfolio, Position, Trade } from "../types/index.ts";

export interface Fill {
  txHash: string;
  filledUsd: number;
}

export class Store {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS positions (token TEXT PRIMARY KEY, qtyBase REAL NOT NULL, entryPxUsd REAL NOT NULL, markPxUsd REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS fills (clientOrderId TEXT PRIMARY KEY, ts INTEGER NOT NULL, token TEXT NOT NULL, side TEXT NOT NULL, sizeUsd REAL NOT NULL, txHash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, regime TEXT NOT NULL, action TEXT NOT NULL, sizeUsd REAL NOT NULL, realizedPnl REAL NOT NULL, stateHash TEXT NOT NULL);
    `);
  }

  initialize(startingCapitalUsd: number): void {
    if (this.getNumber("equityUsd") === undefined) {
      this.setNumber("equityUsd", startingCapitalUsd);
      this.setNumber("highWaterUsd", startingCapitalUsd);
      this.setNumber("tradeCount", 0);
    }
  }

  getPortfolio(): Portfolio {
    const positions = this.db
      .prepare("SELECT token, qtyBase, entryPxUsd, markPxUsd FROM positions")
      .all() as unknown as Position[];
    return {
      equityUsd: this.getNumber("equityUsd") ?? 0,
      highWaterUsd: this.getNumber("highWaterUsd") ?? 0,
      tradeCount: this.getNumber("tradeCount") ?? 0,
      positions,
    };
  }

  alreadyFilled(clientOrderId: string): boolean {
    return this.db.prepare("SELECT 1 FROM fills WHERE clientOrderId = ?").get(clientOrderId) !== undefined;
  }

  recordFill(trade: Trade, fill: Fill, ts: number): void {
    this.db
      .prepare("INSERT OR IGNORE INTO fills (clientOrderId, ts, token, side, sizeUsd, txHash) VALUES (?, ?, ?, ?, ?, ?)")
      .run(trade.clientOrderId, ts, trade.token, trade.side, fill.filledUsd, fill.txHash);
    this.setNumber("tradeCount", (this.getNumber("tradeCount") ?? 0) + 1);
  }

  lastTradeMap(): Record<string, number> {
    const rows = this.db.prepare("SELECT token, MAX(ts) AS ts FROM fills GROUP BY token").all() as unknown as {
      token: string;
      ts: number;
    }[];
    return Object.fromEntries(rows.map((r) => [r.token, r.ts]));
  }

  appendLedger(entry: LedgerEntry): void {
    this.db
      .prepare("INSERT INTO ledger (ts, regime, action, sizeUsd, realizedPnl, stateHash) VALUES (?, ?, ?, ?, ?, ?)")
      .run(entry.ts, entry.regime, entry.action, entry.sizeUsd, entry.realizedPnl, entry.stateHash);
  }

  setEquity(equityUsd: number): void {
    this.setNumber("equityUsd", equityUsd);
    if (equityUsd > (this.getNumber("highWaterUsd") ?? 0)) this.setNumber("highWaterUsd", equityUsd);
  }

  private getNumber(key: string): number | undefined {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as unknown as { value: string } | undefined;
    return row === undefined ? undefined : Number(row.value);
  }

  private setNumber(key: string, value: number): void {
    this.db
      .prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, String(value));
  }
}
