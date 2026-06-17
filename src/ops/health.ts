import { createServer, type Server } from "node:http";

export class HealthServer {
  private server?: Server;
  private status = "starting";
  private lastTickUnix = 0;
  private extra: Record<string, unknown> = {};

  constructor(private readonly port: number) {}

  start(): void {
    this.server = createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: this.status, lastTickUnix: this.lastTickUnix, ...this.extra }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    this.server.listen(this.port);
  }

  beat(extra: Record<string, unknown> = {}): void {
    this.status = "ok";
    this.lastTickUnix = Math.floor(Date.now() / 1000);
    this.extra = extra;
  }

  stop(): void {
    this.server?.close();
  }
}
