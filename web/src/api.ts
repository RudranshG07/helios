export interface AgentState {
  running: boolean;
  status?: string;
  regime?: string;
  verdict?: string;
  sentiment?: number;
  rationale?: string;
  killSwitch?: boolean;
  walletAddress?: string | null;
  owner?: string | null;
  agentId?: string | null;
  riskPolicyHash?: string;
  metrics?: {
    startingCapitalUsd: number;
    equityUsd: number;
    totalReturnPct: number;
    realizedPnlUsd: number;
    maxDrawdownPct: number;
    winRate: number;
    profitFactor: number;
    tradeCount: number;
  };
  positions?: { token: string; qtyBase: number; markPxUsd: number }[];
  ledger?: { ts: number; regime: string; action: string; sizeUsd: number; rationale?: string }[];
  equityHistory?: { ts: number; equityUsd: number }[];
  bestToken?: string;
  holding?: string[];
}

export interface RiskRules {
  maxExposurePct: number;
  maxPositionPctPerToken: number;
  maxTradeSizeUsd: number;
  hardDrawdownStopPct: number;
  maxSlippageBps: number;
  cooldownMinutes: number;
}

const USER_KEY = "helios_user";
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export const getUserId = (): string | null => localStorage.getItem(USER_KEY);
export const clearUser = (): void => localStorage.removeItem(USER_KEY);

function authHeaders(): Record<string, string> {
  const id = getUserId();
  const h: Record<string, string> = { "content-type": "application/json" };
  if (id) h["x-helios-user"] = id;
  return h;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + url, { headers: authHeaders(), ...init });
  if (res.status === 401) {
    clearUser(); // stale account id — drop it so we stop retrying
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  signup: async () => {
    const r = await jsonFetch<{ userId: string; walletAddress: string }>("/api/signup", { method: "POST", body: "{}" });
    localStorage.setItem(USER_KEY, r.userId);
    return r;
  },
  me: () => jsonFetch<AgentState>("/api/me"),
  connect: async (address: string) => {
    const r = await jsonFetch<{ userId: string; walletAddress: string; owner?: string }>("/api/connect", { method: "POST", body: JSON.stringify({ address }) });
    localStorage.setItem(USER_KEY, r.userId);
    return r;
  },
  balance: () => jsonFetch<{ address: string; bnb: number; unreachable?: boolean }>("/api/balance"),
  withdraw: (to: string) => jsonFetch<{ ok: boolean; txHash?: string; amountBnb?: number; reason?: string }>("/api/withdraw", { method: "POST", body: JSON.stringify({ to }) }),
  state: () => jsonFetch<AgentState>("/api/state"),
  config: () => jsonFetch<Record<string, unknown>>("/api/config"),
  saveConfig: (body: unknown) => jsonFetch("/api/config", { method: "PUT", body: JSON.stringify(body) }),
  control: (action: "start" | "stop" | "kill" | "resume") => jsonFetch("/api/control", { method: "POST", body: JSON.stringify({ action }) }),
};
