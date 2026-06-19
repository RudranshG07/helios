import type { MarketState } from "../types/index.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001";

export interface Analysis {
  sentiment: number;
  rationale: string;
}

export async function analyze(state: MarketState, news = ""): Promise<Analysis> {
  const key = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;
  if (!key) return { sentiment: 0, rationale: "" };

  const t = state.technicals;
  const snapshot = `regime=${state.regime} momentum=${t.momentum} trend=${t.trend} crossAssetPressure=${state.crossAssetPressure} priceUsd=${state.price} liquidityUsd=${state.liquidityUsd} riskFlags=[${state.riskFlags.join(",")}]${news ? `\nrecent news: ${news}` : ""}`;
  const prompt = `You are the market analyst for an autonomous BNB (BSC) trading agent. From this snapshot, judge the short-term outlook for BNB and reply with STRICT JSON only: {"sentiment": <number -1..1, positive=bullish>, "rationale": "<one concise sentence>"}.\n\n${snapshot}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 200, messages: [{ role: "user", content: prompt }] }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as { content?: { text?: string }[] };
    const text = data.content?.[0]?.text ?? "";
    const parsed = JSON.parse(extractJson(text)) as { sentiment?: number; rationale?: string };
    return { sentiment: clamp(Number(parsed.sentiment) || 0, -1, 1), rationale: String(parsed.rationale ?? "").slice(0, 240) };
  } catch {
    return { sentiment: 0, rationale: "" };
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no json");
  return text.slice(start, end + 1);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
