import type { Config, EvalRequest, EvalResponse } from "../types/index.ts";

export async function evaluate(cfg: Config, req: EvalRequest): Promise<EvalResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.riskEngine.timeoutMs);
  try {
    const res = await fetch(`${cfg.riskEngine.url}/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`risk engine status ${res.status}`);
    return (await res.json()) as EvalResponse;
  } catch (err) {
    return failClosed(req, err);
  } finally {
    clearTimeout(timer);
  }
}

function failClosed(req: EvalRequest, err: unknown): EvalResponse {
  const reason = `risk engine unreachable: ${err instanceof Error ? err.message : String(err)}`;
  return {
    verdict: "ENGINE_DOWN",
    drawdownPct: 0,
    flatten: false,
    approved: [],
    rejected: req.plan.trades.map((trade) => ({ trade, reason })),
    notes: [reason],
  };
}
