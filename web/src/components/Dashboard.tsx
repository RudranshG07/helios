import { useEffect, useState } from "react";
import { api, type AgentState } from "../api.ts";

export function Dashboard({ initial, onStopped }: { initial: AgentState | null; onStopped: () => void }) {
  const [state, setState] = useState<AgentState | null>(initial);

  useEffect(() => {
    const poll = () => api.state().then(setState).catch(() => {});
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  const m = state?.metrics;
  const dd = m ? (m.maxDrawdownPct * 100).toFixed(2) : "—";
  const ret = m ? (m.totalReturnPct * 100).toFixed(2) : "—";
  const killed = state?.killSwitch === true;

  async function control(action: "kill" | "resume" | "stop") {
    await api.control(action);
    if (action === "stop") onStopped();
    else setTimeout(() => api.state().then(setState).catch(() => {}), 500);
  }

  return (
    <div className="dashboard">
      <div className="status-row">
        <span className={`pill ${state?.running ? "ok" : "off"}`}>{state?.running ? "live" : "stopped"}</span>
        <span className="pill">{state?.regime ?? "—"}</span>
        <span className={`pill ${state?.verdict === "BREAKER" || state?.verdict === "KILL" ? "danger" : ""}`}>{state?.verdict ?? "—"}</span>
        {killed && <span className="pill danger">paused</span>}
        <div className="spacer" />
        {killed ? (
          <button className="primary" onClick={() => control("resume")}>Resume</button>
        ) : (
          <button className="warn" onClick={() => control("kill")}>Pause &amp; flatten</button>
        )}
        <button className="ghost" onClick={() => control("stop")}>Stop</button>
      </div>

      <div className="metrics">
        <Metric label="Equity" value={m ? `$${m.equityUsd.toFixed(2)}` : "—"} />
        <Metric label="Total return" value={`${ret}%`} accent={m && m.totalReturnPct >= 0 ? "up" : "down"} />
        <Metric label="Realized PnL" value={m ? `$${m.realizedPnlUsd.toFixed(2)}` : "—"} />
        <Metric label="Max drawdown" value={`${dd}%`} />
        <Metric label="Win rate" value={m ? `${Math.round(m.winRate * 100)}%` : "—"} />
        <Metric label="Trades" value={m ? String(m.tradeCount) : "—"} />
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Positions</h3>
          <table>
            <thead><tr><th>Token</th><th>Qty</th><th>Mark</th><th>Value</th></tr></thead>
            <tbody>
              {(state?.positions ?? []).map((p) => (
                <tr key={p.token}><td>{p.token}</td><td>{p.qtyBase.toFixed(5)}</td><td>${p.markPxUsd.toFixed(2)}</td><td>${(p.qtyBase * p.markPxUsd).toFixed(2)}</td></tr>
              ))}
              {(state?.positions ?? []).length === 0 && <tr><td colSpan={4} className="muted">none</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Recent decisions</h3>
          <table>
            <thead><tr><th>Time</th><th>Regime</th><th>Action</th><th>Size</th></tr></thead>
            <tbody>
              {(state?.ledger ?? []).slice(0, 10).map((e, i) => (
                <tr key={i}><td>{new Date(e.ts * 1000).toLocaleTimeString()}</td><td>{e.regime}</td><td>{e.action}</td><td>${e.sizeUsd.toFixed(2)}</td></tr>
              ))}
              {(state?.ledger ?? []).length === 0 && <tr><td colSpan={4} className="muted">none yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="footer-info">
        {state?.walletAddress && (
          <span>Wallet: <a href={`https://bscscan.com/address/${state.walletAddress}`} target="_blank" rel="noreferrer">{state.walletAddress}</a></span>
        )}
        <span>ERC-8004 identity: {state?.agentId ?? "registering…"}</span>
        {state?.riskPolicyHash && <span>Verifiable risk policy: <code>{state.riskPolicyHash.slice(0, 18)}…</code></span>}
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "up" | "down" }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
