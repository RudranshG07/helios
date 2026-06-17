import { createServer, type Server } from "node:http";
import type { Store } from "../state/store.ts";
import { renderDashboard } from "./dashboard.ts";

export interface Snapshot {
  status: string;
  lastTickUnix: number;
  equityUsd: number;
  highWaterUsd: number;
  drawdownPct: number;
  tradeCount: number;
  positions: { token: string; qtyBase: number; entryPxUsd: number; markPxUsd: number }[];
  agentId: string | null;
  walletAddress: string | null;
  ledger: { ts: number; regime: string; action: string; sizeUsd: number; realizedPnl: number }[];
  [key: string]: unknown;
}

export class OpsServer {
  private server?: Server;
  private readonly store: Store;
  private readonly port: number;
  private status = "starting";
  private lastTickUnix = 0;
  private beatExtra: Record<string, unknown> = {};

  constructor(store: Store, port: number) {
    this.store = store;
    this.port = port;
  }

  start(): void {
    this.server = createServer((req, res) => {
      const url = req.url ?? "/";
      if (url === "/health") return this.json(res, { status: this.status, lastTickUnix: this.lastTickUnix, ...this.beatExtra });
      if (url === "/state") return this.json(res, this.snapshot());
      if (url === "/" || url.startsWith("/?")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(renderDashboard(this.snapshot()));
      }
      res.writeHead(404);
      res.end();
    });
    this.server.listen(this.port);
  }

  beat(extra: Record<string, unknown> = {}): void {
    this.status = "ok";
    this.lastTickUnix = Math.floor(Date.now() / 1000);
    this.beatExtra = extra;
  }

  stop(): void {
    this.server?.close();
  }

  private snapshot(): Snapshot {
    const p = this.store.getPortfolio();
    const drawdownPct = p.highWaterUsd > 0 ? Math.max(0, (p.highWaterUsd - p.equityUsd) / p.highWaterUsd) : 0;
    return {
      status: this.status,
      lastTickUnix: this.lastTickUnix,
      equityUsd: p.equityUsd,
      highWaterUsd: p.highWaterUsd,
      drawdownPct,
      tradeCount: p.tradeCount,
      positions: p.positions,
      agentId: this.store.getMeta("agentId") ?? null,
      walletAddress: process.env.TWAK_WALLET_ADDRESS ?? null,
      ledger: this.store.getRecentLedger(20),
      ...this.beatExtra,
    };
  }

  private json(res: import("node:http").ServerResponse, body: unknown): void {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  }
}
