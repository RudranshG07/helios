import { spawn } from "node:child_process";

export async function registerIdentity(uri: string, chain: string, password?: string): Promise<string> {
  const args = ["erc8004", "register", "--uri", uri, "--chain", chain, "--json"];
  if (password) args.push("--password", password);
  const raw = JSON.parse(extractJson(await run(args))) as { agentId?: string; id?: string; error?: string };
  if (raw.error) throw new Error(`erc8004 register: ${raw.error}`);
  const agentId = raw.agentId ?? raw.id;
  if (!agentId) throw new Error("erc8004 register: no agentId returned");
  return agentId;
}

export async function setMetadata(agentId: string, key: string, value: string, chain: string, password?: string): Promise<void> {
  const args = ["erc8004", "set-metadata", agentId, "--key", key, "--value", value, "--chain", chain, "--json"];
  if (password) args.push("--password", password);
  const raw = JSON.parse(extractJson(await run(args))) as { error?: string };
  if (raw.error) throw new Error(`erc8004 set-metadata: ${raw.error}`);
}

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.TWAK_BIN ?? "twak", args, { env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("twak erc8004 timed out"));
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
      else reject(new Error(`twak erc8004 exited ${code}: ${stderr.trim() || "no output"}`));
    });
  });
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error(`no json in twak output: ${text.slice(0, 120)}`);
  return text.slice(start, end + 1);
}
