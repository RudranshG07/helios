import { errorLog, log } from "../util/log.ts";

export class Alerter {
  private readonly url: string;
  private readonly throttleMs: number;
  private readonly lastSent = new Map<string, number>();

  constructor(url: string, throttleMs = 5 * 60 * 1000) {
    this.url = url;
    this.throttleMs = throttleMs;
  }

  async send(key: string, message: string): Promise<void> {
    log("alert", { key, message });
    if (!this.url) return;

    const now = Date.now();
    if (now - (this.lastSent.get(key) ?? 0) < this.throttleMs) return;
    this.lastSent.set(key, now);

    try {
      await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `[helios] ${message}` }),
      });
    } catch (err) {
      errorLog("alert delivery failed", err, { key });
    }
  }
}
