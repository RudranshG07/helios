const MCP_URL = "https://mcp.coinmarketcap.com/mcp";

type ToolResult = Record<string, unknown> | unknown[];

interface McpEnvelope {
  result?: { content?: { text?: string }[] };
  error?: unknown;
}

export async function callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const key = process.env.CMC_MCP_API_KEY ?? process.env.CMC_API_KEY;
  if (!key) throw new Error("CMC_MCP_API_KEY not set");

  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(MCP_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "x-cmc-mcp-api-key": key,
        },
        body,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`mcp status ${res.status} for ${name}`);

      const payload = (await res.json()) as McpEnvelope;
      if (payload.error) throw new Error(`mcp error for ${name}: ${JSON.stringify(payload.error)}`);

      const text = payload.result?.content?.[0]?.text;
      if (text === undefined) throw new Error(`mcp empty content for ${name}`);
      return JSON.parse(text) as ToolResult;
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}
