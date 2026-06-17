import { spawn } from "node:child_process";

export interface SwapQuote {
  inputAmount: number;
  inputToken: string;
  outputAmount: number;
  outputToken: string;
  minReceived: number;
  provider: string;
  priceImpactPct: number;
}

export interface SwapResult extends SwapQuote {
  txHash: string;
}

export interface SwapArgs {
  sizeUsd: number;
  from: string;
  to: string;
  chain: string;
  slippagePct: number;
  password?: string;
}

interface RawQuote {
  input?: string;
  output?: string;
  minReceived?: string;
  provider?: string;
  priceImpact?: string;
  txHash?: string;
  hash?: string;
  error?: string;
  errorCode?: string;
}

export async function twakSwap(args: SwapArgs, quoteOnly: boolean): Promise<SwapResult> {
  const cli = ["swap", "--usd", String(args.sizeUsd), args.from, args.to, "--chain", args.chain, "--slippage", String(args.slippagePct), "--json"];
  if (quoteOnly) cli.push("--quote-only");
  else if (args.password) cli.push("--password", args.password);

  const stdout = await run(process.env.TWAK_BIN ?? "twak", cli);
  const raw = JSON.parse(extractJson(stdout)) as RawQuote;
  if (raw.error) throw new Error(`twak swap ${args.from}->${args.to}: ${raw.error}`);

  return {
    inputAmount: leadingNumber(raw.input),
    inputToken: trailingToken(raw.input),
    outputAmount: leadingNumber(raw.output),
    outputToken: trailingToken(raw.output),
    minReceived: leadingNumber(raw.minReceived),
    provider: raw.provider ?? "",
    priceImpactPct: Number.parseFloat(raw.priceImpact ?? "0"),
    txHash: raw.txHash ?? raw.hash ?? "",
  };
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("twak swap timed out"));
    }, 90_000);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (stdout.includes("{")) resolve(stdout);
      else reject(new Error(`twak exited ${code}: ${stderr.trim() || "no output"}`));
    });
  });
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error(`no json in twak output: ${text.slice(0, 120)}`);
  return text.slice(start, end + 1);
}

function leadingNumber(s: string | undefined): number {
  return s ? Number.parseFloat(s) : NaN;
}

function trailingToken(s: string | undefined): string {
  if (!s) return "";
  const parts = s.trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}
