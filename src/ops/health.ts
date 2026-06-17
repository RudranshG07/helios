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
  riskPolicyHash: string;
  metrics: { totalReturnPct: number; realizedPnlUsd: number; maxDrawdownPct: number; winRate: number; profitFactor: number; tradeCount: number; startingCapitalUsd: number; equityUsd: number };
  ledger: { ts: number; regime: string; action: string; sizeUsd: number; realizedPnl: number }[];
  [key: string]: unknown;
}

export class OpsServer {
  private server?: Server;
  private readonly store: Store;
  private readonly port: number;
  private readonly policyHash: string;
  private status = "starting";
  private lastTickUnix = 0;
  private beatExtra: Record<string, unknown> = {};
  private signal: Record<string, unknown> = {};

  constructor(store: Store, port: number, policyHash: string) {
    this.store = store;
    this.port = port;
    this.policyHash = policyHash;
  }

  start(): void {
    this.server = createServer((req, res) => {
      const url = req.url ?? "/";
      if (req.method === "POST" && (url === "/kill" || url === "/resume")) {
        if (!authorized(req)) {
          res.writeHead(403, { "content-type": "application/json" });
          return res.end(JSON.stringify({ error: "forbidden" }));
        }
        const on = url === "/kill";
        this.store.setKill(on);
        return this.json(res, { killSwitch: on });
      }
      if (url === "/signal") return this.serveSignal(req, res);
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

  setSignal(signal: Record<string, unknown>): void {
    this.signal = signal;
  }

  private serveSignal(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse): void {
    if (!req.headers["x-payment"]) {
      res.writeHead(402, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          x402Version: 1,
          error: "payment required",
          accepts: [
            {
              scheme: "exact",
              network: "base",
              asset: "USDC",
              maxAmountRequired: "10000",
              payTo: process.env.TWAK_WALLET_ADDRESS ?? "",
              resource: "/signal",
              description: "Helios live trading signal",
              mimeType: "application/json",
            },
          ],
        }),
      );
      return;
    }
    this.json(res, this.signal);
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
      realizedPnlUsd: this.store.realizedPnl(),
      killSwitch: this.store.killActive(),
      tradeCount: p.tradeCount,
      positions: p.positions,
      agentId: this.store.getMeta("agentId") ?? null,
      walletAddress: process.env.TWAK_WALLET_ADDRESS ?? null,
      riskPolicyHash: this.policyHash,
      metrics: this.store.metrics(),
      ledger: this.store.getRecentLedger(20),
      ...this.beatExtra,
    };
  }

  private json(res: import("node:http").ServerResponse, body: unknown): void {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  }
}

function authorized(req: import("node:http").IncomingMessage): boolean {
  const token = process.env.OPS_TOKEN;
  if (!token) return true;
  return req.headers["authorization"] === `Bearer ${token}`;
}
