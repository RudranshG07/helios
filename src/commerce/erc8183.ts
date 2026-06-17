import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

export function signalCommitment(signal: unknown): string {
  return "0x" + createHash("sha256").update(JSON.stringify(signal)).digest("hex");
}

export async function jobStatus(jobId: string, chain: string): Promise<unknown> {
  return JSON.parse(extractJson(await run(["erc8183", "status", jobId, "--chain", chain, "--json"])));
}

export async function submitDeliverable(jobId: string, deliverable: string, chain: string, password?: string): Promise<void> {
  const args = ["erc8183", "submit", jobId, "--deliverable", deliverable, "--chain", chain, "--json"];
  if (password) args.push("--password", password);
  const raw = JSON.parse(extractJson(await run(args))) as { error?: string };
  if (raw.error) throw new Error(`erc8183 submit: ${raw.error}`);
}

export async function completeJob(jobId: string, chain: string, password?: string): Promise<void> {
  const args = ["erc8183", "complete", jobId, "--chain", chain, "--json"];
  if (password) args.push("--password", password);
  const raw = JSON.parse(extractJson(await run(args))) as { error?: string };
  if (raw.error) throw new Error(`erc8183 complete: ${raw.error}`);
}

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.TWAK_BIN ?? "twak", args, { env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("twak erc8183 timed out"));
    }, 120_000);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (stdout.includes("{")) resolve(stdout);
      else reject(new Error(`twak erc8183 exited ${code}: ${stderr.trim() || "no output"}`));
    });
  });
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error(`no json in twak output: ${text.slice(0, 120)}`);
  return text.slice(start, end + 1);
}
