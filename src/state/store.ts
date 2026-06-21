import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LedgerEntry, Portfolio, Position } from "../types/index.ts";

export interface Fill {
  txHash: string;
  token: string;
  stableDelta: number;
  tokenDelta: number;
  notionalUsd: number;
}

export class Store {
  private db: DatabaseSync;
  private stable: string;

  constructor(path: string, stable: string) {
    this.stable = stable;
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS positions (token TEXT PRIMARY KEY, qtyBase REAL NOT NULL, entryPxUsd REAL NOT NULL, markPxUsd REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS fills (clientOrderId TEXT PRIMARY KEY, ts INTEGER NOT NULL, token TEXT NOT NULL, stableDelta REAL NOT NULL, tokenDelta REAL NOT NULL, notionalUsd REAL NOT NULL, realizedPnl REAL NOT NULL DEFAULT 0, txHash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, regime TEXT NOT NULL, action TEXT NOT NULL, sizeUsd REAL NOT NULL, realizedPnl REAL NOT NULL, rationale TEXT NOT NULL DEFAULT '', stateHash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS equity_points (ts INTEGER PRIMARY KEY, equityUsd REAL NOT NULL);
    `);
  }

  initialize(startingCapitalUsd: number): void {
    if (this.getNumber("initialized") === 1) return;
    this.upsertPosition(this.stable, startingCapitalUsd, 1, 1);
    this.setNumber("startingCapitalUsd", startingCapitalUsd);
    this.setNumber("highWaterUsd", startingCapitalUsd);
    this.setNumber("maxDrawdownPct", 0);
    this.setNumber("tradeCount", 0);
    this.setNumber("initialized", 1);
  }

  reseedStable(stableUsd: number): void {
    if ((this.getNumber("tradeCount") ?? 0) > 0) return;
    this.upsertPosition(this.stable, stableUsd, 1, 1);
    this.setNumber("startingCapitalUsd", stableUsd);
    this.setNumber("highWaterUsd", stableUsd);
    this.setNumber("maxDrawdownPct", 0);
  }

  updateMaxDrawdown(): void {
    const p = this.getPortfolio();
    if (p.highWaterUsd <= 0) return;
    const dd = Math.max(0, (p.highWaterUsd - p.equityUsd) / p.highWaterUsd);
    if (dd > (this.getNumber("maxDrawdownPct") ?? 0)) this.setNumber("maxDrawdownPct", dd);
  }

  metrics(): {
    startingCapitalUsd: number;
    equityUsd: number;
    totalReturnPct: number;
    realizedPnlUsd: number;
    maxDrawdownPct: number;
    tradeCount: number;
    winRate: number;
    profitFactor: number;
  } {
    const start = this.getNumber("startingCapitalUsd") ?? 0;
    const equity = this.equity();
    const realized = this.db.prepare("SELECT realizedPnl FROM fills WHERE realizedPnl != 0").all() as unknown as { realizedPnl: number }[];
    const wins = realized.filter((r) => r.realizedPnl > 0);
    const grossProfit = wins.reduce((s, r) => s + r.realizedPnl, 0);
    const grossLoss = realized.filter((r) => r.realizedPnl < 0).reduce((s, r) => s - r.realizedPnl, 0);
    return {
      startingCapitalUsd: start,
      equityUsd: equity,
      totalReturnPct: start > 0 ? (equity - start) / start : 0,
      realizedPnlUsd: this.realizedPnl(),
      maxDrawdownPct: this.getNumber("maxDrawdownPct") ?? 0,
      tradeCount: this.getNumber("tradeCount") ?? 0,
      winRate: realized.length > 0 ? wins.length / realized.length : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    };
  }

  markPrices(priceByToken: Record<string, number>): void {
    for (const [token, px] of Object.entries(priceByToken)) {
      if (token === this.stable || !Number.isFinite(px) || px <= 0) continue;
      this.db.prepare("UPDATE positions SET markPxUsd = ? WHERE token = ?").run(px, token);
    }
  }

  refreshHighWater(): void {
    const equity = this.equity();
    if (equity > (this.getNumber("highWaterUsd") ?? 0)) this.setNumber("highWaterUsd", equity);
  }

  updateVolatility(price: number): void {
    const last = this.getNumber("volLastPrice");
    if (last && last > 0 && price > 0) {
      const ret = Math.abs(Math.log(price / last));
      const fast = this.getNumber("volFast") ?? ret;
      const slow = this.getNumber("volSlow") ?? ret;
      this.setNumber("volFast", 0.2 * ret + 0.8 * fast);
      this.setNumber("volSlow", 0.02 * ret + 0.98 * slow);
    }
    this.setNumber("volLastPrice", price);
  }

  volScale(): number {
    const fast = this.getNumber("volFast");
    const slow = this.getNumber("volSlow");
    if (!fast || !slow || fast <= 0) return 1;
    return Math.max(0.3, Math.min(1.5, slow / fast));
  }

  getPortfolio(): Portfolio {
    return {
      equityUsd: this.equity(),
      highWaterUsd: this.getNumber("highWaterUsd") ?? this.equity(),
      tradeCount: this.getNumber("tradeCount") ?? 0,
      positions: this.allPositions(),
    };
  }

  alreadyFilled(clientOrderId: string): boolean {
    return this.db.prepare("SELECT 1 FROM fills WHERE clientOrderId = ?").get(clientOrderId) !== undefined;
  }

  applyFill(fill: Fill, ts: number, clientOrderId: string): number {
    if (this.alreadyFilled(clientOrderId)) return 0;

    let realizedPnl = 0;
    if (fill.tokenDelta < 0) {
      const entry = this.positionEntry(fill.token);
      const qty = Math.abs(fill.tokenDelta);
      if (entry !== undefined && qty > 0) realizedPnl = (fill.notionalUsd / qty - entry) * qty;
    }

    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("INSERT INTO fills (clientOrderId, ts, token, stableDelta, tokenDelta, notionalUsd, realizedPnl, txHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(clientOrderId, ts, fill.token, fill.stableDelta, fill.tokenDelta, fill.notionalUsd, realizedPnl, fill.txHash);

      this.addToPosition(this.stable, fill.stableDelta, 1);
      const tokenPx = Math.abs(fill.tokenDelta) > 0 ? fill.notionalUsd / Math.abs(fill.tokenDelta) : 0;
      this.addToPosition(fill.token, fill.tokenDelta, tokenPx);

      this.setNumber("tradeCount", (this.getNumber("tradeCount") ?? 0) + 1);
      this.setNumber("realizedPnlUsd", (this.getNumber("realizedPnlUsd") ?? 0) + realizedPnl);
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
    return realizedPnl;
  }

  realizedPnl(): number {
    return this.getNumber("realizedPnlUsd") ?? 0;
  }

  killActive(): boolean {
    return this.getNumber("killSwitch") === 1;
  }

  setKill(on: boolean): void {
    this.setNumber("killSwitch", on ? 1 : 0);
  }

  lastTradeMap(): Record<string, number> {
    const rows = this.db.prepare("SELECT token, MAX(ts) AS ts FROM fills GROUP BY token").all() as unknown as {
      token: string;
      ts: number;
    }[];
    return Object.fromEntries(rows.map((r) => [r.token, r.ts]));
  }

  lastFillUnix(): number {
    const row = this.db.prepare("SELECT MAX(ts) AS ts FROM fills").get() as unknown as { ts: number | null } | undefined;
    return row?.ts ?? 0;
  }

  dailyNotionalUsd(nowUnix: number): number {
    const row = this.db.prepare("SELECT COALESCE(SUM(notionalUsd), 0) AS total FROM fills WHERE ts >= ?").get(nowUnix - 86_400) as unknown as { total: number } | undefined;
    return row?.total ?? 0;
  }

  getRecentLedger(limit: number): LedgerEntry[] {
    return this.db
      .prepare("SELECT ts, regime, action, sizeUsd, realizedPnl, rationale, stateHash FROM ledger ORDER BY id DESC LIMIT ?")
      .all(limit) as unknown as LedgerEntry[];
  }

  recordEquityPoint(ts: number, equityUsd: number): void {
    this.db.prepare("INSERT OR REPLACE INTO equity_points (ts, equityUsd) VALUES (?, ?)").run(ts, equityUsd);
  }

  getEquityHistory(limit: number): { ts: number; equityUsd: number }[] {
    const rows = this.db.prepare("SELECT ts, equityUsd FROM equity_points ORDER BY ts DESC LIMIT ?").all(limit) as unknown as { ts: number; equityUsd: number }[];
    return rows.reverse();
  }

  appendLedger(entry: LedgerEntry): void {
    this.db
      .prepare("INSERT INTO ledger (ts, regime, action, sizeUsd, realizedPnl, rationale, stateHash) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(entry.ts, entry.regime, entry.action, entry.sizeUsd, entry.realizedPnl, entry.rationale, entry.stateHash);
  }

  getMeta(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as unknown as { value: string } | undefined;
    return row?.value;
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, value);
  }

  private equity(): number {
    return this.allPositions().reduce((sum, p) => sum + p.qtyBase * p.markPxUsd, 0);
  }

  private positionEntry(token: string): number | undefined {
    const row = this.db.prepare("SELECT entryPxUsd FROM positions WHERE token = ?").get(token) as unknown as { entryPxUsd: number } | undefined;
    return row?.entryPxUsd;
  }

  private allPositions(): Position[] {
    return this.db
      .prepare("SELECT token, qtyBase, entryPxUsd, markPxUsd FROM positions")
      .all() as unknown as Position[];
  }

  private addToPosition(token: string, qtyDelta: number, pricePerUnit: number): void {
    const row = this.db.prepare("SELECT qtyBase, entryPxUsd FROM positions WHERE token = ?").get(token) as unknown as
      | { qtyBase: number; entryPxUsd: number }
      | undefined;
    const oldQty = row?.qtyBase ?? 0;
    const newQty = oldQty + qtyDelta;

    if (newQty <= 1e-9) {
      this.db.prepare("DELETE FROM positions WHERE token = ?").run(token);
      return;
    }

    let entry = row?.entryPxUsd ?? pricePerUnit;
    if (qtyDelta > 0 && pricePerUnit > 0) entry = (oldQty * entry + qtyDelta * pricePerUnit) / newQty;
    const mark = pricePerUnit > 0 ? pricePerUnit : entry;
    this.upsertPosition(token, newQty, entry, mark);
  }

  private upsertPosition(token: string, qtyBase: number, entryPxUsd: number, markPxUsd: number): void {
    this.db
      .prepare(
        "INSERT INTO positions (token, qtyBase, entryPxUsd, markPxUsd) VALUES (?, ?, ?, ?) ON CONFLICT(token) DO UPDATE SET qtyBase = excluded.qtyBase, entryPxUsd = excluded.entryPxUsd, markPxUsd = excluded.markPxUsd",
      )
      .run(token, qtyBase, entryPxUsd, markPxUsd);
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
