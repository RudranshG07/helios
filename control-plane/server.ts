import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { Wallet, JsonRpcProvider, formatEther, parseEther, Contract } from "ethers";
import { Store } from "../src/state/store.ts";
import { UNIVERSE, STABLE } from "../src/universe.ts";

const ROOT = resolve(import.meta.dirname, "..");
const BASE_CONFIG = resolve(ROOT, "config.json");
const ENV = resolve(ROOT, ".env");
const DATA = resolve(ROOT, "data");
const REGISTRY = resolve(DATA, "registry.json");
const WEB_DIST = resolve(ROOT, "web", "dist");
const PORT = Number(process.env.PORT ?? process.env.CONTROL_PORT ?? 8090);
const ENGINE_ADDR = "127.0.0.1:8081";

const mainnetChain = { chainId: 56, twakChain: "smartchain", erc8004Chain: "bsc", rpcUrls: ["https://bsc-dataseed.bnbchain.org", "https://bsc-dataseed1.defibit.io"], confirmations: 1, gasBumpPct: 12, txTimeoutSeconds: 90 };
const testnetChain = { chainId: 97, twakChain: "smartchain-testnet", erc8004Chain: "bsctestnet", rpcUrls: ["https://data-seed-prebsc-1-s1.bnbchain.org:8545"], confirmations: 1, gasBumpPct: 12, txTimeoutSeconds: 90 };

const SHOWCASE = {
  wallet: "0x3864b8A47B187fF2829BFf2f74D772811F727Cf7",
  agentId: "139935",
  registered: true,
  deadline: "2026-06-25T00:00:00.000Z",
  registerTx: "0x9348e927430a6bf269f3f7afda3c4a4c9d0291656937699bcc02ed7f116941a6",
  identityTx: "0x905e74fde4c446bb873df4dabeff40d8e450e93ff415c3968d515f158e110b3d",
  fundTx: "0xeae3774af67bb6c99d9f2baf5720382a8987421385e07c72938608a71606d17e",
};

const SHOWCASE_SEED_USD = 10.95; // on-chain USDT the agent was funded with
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
let scCache: { ts: number; data: Record<string, unknown> } | null = null;

async function priceUsd(symbol: string): Promise<number> {
  if (symbol === STABLE.symbol) return 1;
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`, { signal: AbortSignal.timeout(6000) });
    const d = (await r.json()) as { price?: string };
    return d.price ? Number(d.price) : 0;
  } catch {
    return 0;
  }
}

async function onchainPortfolio(wallet: string): Promise<{ equityUsd: number; positions: { token: string; qtyBase: number; markPxUsd: number }[] } | null> {
  try {
    const provider = new JsonRpcProvider(mainnetChain.rpcUrls[0]);
    const positions: { token: string; qtyBase: number; markPxUsd: number }[] = [];
    let equity = 0;
    const tokens = [STABLE, ...UNIVERSE];
    const results = await Promise.all(tokens.map(async (t) => {
      const bal = Number(await new Contract(t.address, ERC20_ABI, provider).balanceOf(wallet)) / 10 ** t.decimals;
      const px = bal > 0 ? await priceUsd(t.symbol) : 0;
      return { t, bal, px };
    }));
    for (const { t, bal, px } of results) {
      const val = bal * px;
      if (t.symbol === STABLE.symbol || val >= 0.5) {
        positions.push({ token: t.symbol, qtyBase: bal, markPxUsd: px });
        equity += val;
      }
    }
    return { equityUsd: equity, positions };
  } catch {
    return null;
  }
}

async function showcase(): Promise<Record<string, unknown>> {
  if (scCache && Date.now() - scCache.ts < 20_000) return scCache.data;
  let metrics: Record<string, unknown> | null = null;
  let equityHistory: { ts: number; equityUsd: number }[] = [];
  let positions: { token: string; qtyBase: number; markPxUsd: number }[] = [];
  let live = false;
  try {
    const dbPath = process.env.HELIOS_DB ?? resolve(DATA, "helios.db");
    if (existsSync(dbPath)) {
      const cfg = JSON.parse(readFileSync(BASE_CONFIG, "utf8"));
      const store = new Store(dbPath, cfg.risk.stableAsset);
      const m = store.metrics();
      if (m.tradeCount > 0) {
        metrics = m as unknown as Record<string, unknown>;
        equityHistory = store.getEquityHistory(200);
        positions = store.getPortfolio().positions.map((p) => ({ token: p.token, qtyBase: p.qtyBase, markPxUsd: p.markPxUsd }));
        live = true;
      }
    }
  } catch {
    metrics = null;
  }
  // no local trade data (e.g. hosted backend) → read the real on-chain wallet
  if (!live) {
    const oc = await onchainPortfolio(SHOWCASE.wallet);
    if (oc) {
      positions = oc.positions;
      const held = oc.positions.filter((p) => p.token !== STABLE.symbol);
      live = held.length > 0;
      metrics = {
        startingCapitalUsd: SHOWCASE_SEED_USD,
        equityUsd: oc.equityUsd,
        totalReturnPct: SHOWCASE_SEED_USD > 0 ? (oc.equityUsd - SHOWCASE_SEED_USD) / SHOWCASE_SEED_USD : 0,
        realizedPnlUsd: 0,
        maxDrawdownPct: 0,
        winRate: 0,
        profitFactor: 0,
        tradeCount: live ? 1 : 0,
      };
    }
  }
  const data = { ...SHOWCASE, live, metrics, equityHistory, positions };
  scCache = { ts: Date.now(), data };
  return data;
}

interface User {
  id: string;
  owner?: string;
  walletAddress: string;
  walletKey: string;
  port: number;
  createdAt: number;
}

mkdirSync(DATA, { recursive: true });
const users: Record<string, User> = existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, "utf8")) : {};
const agents = new Map<string, ChildProcess>();
let engine: ChildProcess | undefined;

const saveRegistry = () => writeFileSync(REGISTRY, JSON.stringify(users, null, 2));

function baseEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (existsSync(ENV)) {
    for (const line of readFileSync(ENV, "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return env;
}

function userDir(id: string): string {
  const dir = resolve(DATA, id);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function userConfigPath(id: string): string {
  return resolve(userDir(id), "config.json");
}

function readUserConfig(id: string): Record<string, unknown> {
  const path = userConfigPath(id);
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  const base = JSON.parse(readFileSync(BASE_CONFIG, "utf8"));
  (base.ops as Record<string, unknown>).healthPort = users[id].port;
  (base.riskEngine as Record<string, unknown>).url = `http://${ENGINE_ADDR}`;
  writeFileSync(path, JSON.stringify(base, null, 2));
  return base;
}

function ensureEngine(): void {
  if (engine) return;
  engine = spawn(resolve(ROOT, "risk-engine", "bin", "risk-engine"), { env: { ...process.env, RISK_ENGINE_ADDR: ENGINE_ADDR }, stdio: "inherit" });
  engine.on("exit", () => (engine = undefined));
}

function startAgent(u: User): void {
  ensureEngine();
  if (agents.has(u.id)) return;
  readUserConfig(u.id);
  const proc = spawn("node", ["--disable-warning=ExperimentalWarning", "src/index.ts"], {
    cwd: ROOT,
    env: { ...baseEnv(), HELIOS_CONFIG: userConfigPath(u.id), HELIOS_DB: resolve(userDir(u.id), "helios.db"), TWAK_WALLET_ADDRESS: u.walletAddress, FALLBACK_PRIVATE_KEY: u.walletKey },
    stdio: "inherit",
  });
  proc.on("exit", () => agents.delete(u.id));
  agents.set(u.id, proc);
}

function stopAgent(id: string): void {
  agents.get(id)?.kill("SIGTERM");
  agents.delete(id);
}

async function proxyState(u: User): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`http://127.0.0.1:${u.port}/state`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error();
    return { running: true, walletAddress: u.walletAddress, owner: u.owner, ...((await res.json()) as Record<string, unknown>) };
  } catch {
    return { running: false, walletAddress: u.walletAddress, owner: u.owner };
  }
}

async function toggleKill(u: User, on: boolean): Promise<void> {
  const token = baseEnv().OPS_TOKEN;
  await fetch(`http://127.0.0.1:${u.port}/${on ? "kill" : "resume"}`, { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(2000) }).catch(() => {});
}

function signup(owner?: string): User {
  const id = randomBytes(12).toString("hex");
  const w = Wallet.createRandom();
  const usedPorts = new Set(Object.values(users).map((u) => u.port));
  let port = 8100;
  while (usedPorts.has(port)) port += 1;
  const u: User = { id, owner, walletAddress: w.address, walletKey: w.privateKey, port, createdAt: Date.now() };
  users[id] = u;
  saveRegistry();
  readUserConfig(id);
  return u;
}

function connect(owner: string): User {
  const existing = Object.values(users).find((u) => u.owner?.toLowerCase() === owner.toLowerCase());
  return existing ?? signup(owner);
}

async function chatWithClaude(message: string, state: Record<string, unknown>): Promise<string> {
  const env = baseEnv();
  const key = env.ANTHROPIC_API_KEY ?? env.CLAUDE_API_KEY;
  if (!key) return "AI chat isn't configured yet (no Claude key set).";
  const ctx = JSON.stringify({ running: state.running, regime: state.regime, verdict: state.verdict, bestToken: state.bestToken, holding: state.holding, metrics: state.metrics, rationale: state.rationale });
  const system =
    "You are Helios, an autonomous, self-custody crypto trading agent on BNB Chain. You read CoinMarketCap signals, rotate into the strongest eligible token only on strong conviction, and gate every trade through a risk engine. Answer the user's question about your decisions, strategy, or current status in 1-3 concise sentences, grounded in the live state JSON. Be direct and honest; never promise profit or give financial guarantees.";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001", max_tokens: 320, system, messages: [{ role: "user", content: `Live state: ${ctx}\n\nQuestion: ${message}` }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return `(chat error ${res.status})`;
    const d = (await res.json()) as { content?: { text?: string }[] };
    return d.content?.[0]?.text ?? "(no reply)";
  } catch (e) {
    return `(chat failed: ${e instanceof Error ? e.message : String(e)})`;
  }
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,x-helios-user", "access-control-allow-methods": "GET,POST,PUT,OPTIONS" });
  res.end(JSON.stringify(body));
}

function currentUser(req: IncomingMessage): User | undefined {
  const id = req.headers["x-helios-user"];
  return typeof id === "string" ? users[id] : undefined;
}

const server = createServer(async (req, res) => {
  const url = (req.url ?? "/").split("?")[0];
  try {
    if (req.method === "OPTIONS") return json(res, 204, {});

    if (url === "/api/signup" && req.method === "POST") {
      const u = signup();
      return json(res, 200, { userId: u.id, walletAddress: u.walletAddress });
    }

    if (url === "/api/connect" && req.method === "POST") {
      const { address } = await readBody(req);
      if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) return json(res, 400, { error: "invalid wallet address" });
      const u = connect(address);
      return json(res, 200, { userId: u.id, walletAddress: u.walletAddress, owner: u.owner });
    }

    if (url === "/api/showcase" && req.method === "GET") return json(res, 200, await showcase());

    if (url.startsWith("/api/")) {
      const u = currentUser(req);
      if (!u) return json(res, 401, { error: "no account" });

      if (url === "/api/me") return json(res, 200, await proxyState(u));
      if (url === "/api/state") return json(res, 200, await proxyState(u));

      if (url === "/api/chat" && req.method === "POST") {
        const { message } = await readBody(req);
        if (typeof message !== "string" || !message.trim()) return json(res, 400, { error: "empty message" });
        return json(res, 200, { reply: await chatWithClaude(message, await proxyState(u)) });
      }

      if (url === "/api/balance") {
        const cfg = readUserConfig(u.id);
        const rpc = ((cfg.chain as { rpcUrls?: string[] }).rpcUrls ?? ["https://bsc-dataseed.bnbchain.org"])[0];
        try {
          const provider = new JsonRpcProvider(rpc);
          const bal = await provider.getBalance(u.walletAddress);
          return json(res, 200, { address: u.walletAddress, bnb: Number(formatEther(bal)) });
        } catch {
          return json(res, 200, { address: u.walletAddress, bnb: 0, unreachable: true });
        }
      }

      if (url === "/api/config" && req.method === "GET") return json(res, 200, readUserConfig(u.id));
      if (url === "/api/config" && req.method === "PUT") {
        const body = await readBody(req);
        const cfg = readUserConfig(u.id);
        cfg.risk = { ...(cfg.risk as object), ...(body.risk as object) };
        if (typeof body.startingCapitalUsd === "number") cfg.startingCapitalUsd = body.startingCapitalUsd;
        if (typeof body.mode === "string") {
          cfg.mode = body.mode;
          if (body.mode === "mainnet") cfg.chain = { ...(cfg.chain as object), ...mainnetChain };
          if (body.mode === "testnet") cfg.chain = { ...(cfg.chain as object), ...testnetChain };
        }
        writeFileSync(userConfigPath(u.id), JSON.stringify(cfg, null, 2));
        return json(res, 200, cfg);
      }

      if (url === "/api/withdraw" && req.method === "POST") {
        const body = await readBody(req);
        const to = u.owner ?? (typeof body.to === "string" ? body.to : "");
        if (!/^0x[a-fA-F0-9]{40}$/.test(to)) return json(res, 400, { error: "no destination: connect a wallet (funds return to its owner)" });
        stopAgent(u.id);
        const cfg = readUserConfig(u.id);
        const rpc = ((cfg.chain as { rpcUrls?: string[] }).rpcUrls ?? ["https://bsc-dataseed.bnbchain.org"])[0];
        const provider = new JsonRpcProvider(rpc);
        const bal = await provider.getBalance(u.walletAddress);
        const gas = parseEther("0.0005");
        if (bal <= gas) return json(res, 200, { ok: false, reason: "insufficient balance to withdraw" });
        const tx = await new Wallet(u.walletKey, provider).sendTransaction({ to, value: bal - gas });
        return json(res, 200, { ok: true, txHash: tx.hash, amountBnb: Number(formatEther(bal - gas)) });
      }

      if (url === "/api/control" && req.method === "POST") {
        const { action } = await readBody(req);
        if (action === "start") startAgent(u);
        else if (action === "stop") stopAgent(u.id);
        else if (action === "kill") await toggleKill(u, true);
        else if (action === "resume") await toggleKill(u, false);
        else return json(res, 400, { error: "unknown action" });
        return json(res, 200, { ok: true, action });
      }
      return json(res, 404, { error: "not found" });
    }

    return serveStatic(url, res);
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

function serveStatic(url: string, res: ServerResponse): void {
  const path = url === "/" ? "/index.html" : url;
  const file = resolve(WEB_DIST, "." + path);
  if (!file.startsWith(WEB_DIST) || !existsSync(file)) {
    const index = resolve(WEB_DIST, "index.html");
    if (existsSync(index)) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(readFileSync(index));
      return;
    }
    res.writeHead(404);
    res.end("build the web app: cd web && npm run build");
    return;
  }
  const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
  res.writeHead(200, { "content-type": types[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream" });
  res.end(readFileSync(file));
}

process.on("SIGTERM", () => {
  for (const id of agents.keys()) stopAgent(id);
  engine?.kill("SIGTERM");
  process.exit(0);
});

server.listen(PORT, () => console.log(`control plane (multi-tenant) on http://127.0.0.1:${PORT}`));
