import { useEffect, useState } from "react";
import { api, type AgentState } from "../api.ts";
import { EquityChart } from "./EquityChart.tsx";
import { CandleChart } from "./CandleChart.tsx";
import { AgentChat } from "./AgentChat.tsx";

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

  async function withdraw() {
    const dest = state?.owner;
    const msg = dest ? `Withdraw all funds to your wallet ${dest}?` : "Withdraw all funds to your connected wallet?";
    if (!window.confirm(msg)) return;
    try {
      const r = await api.withdraw(dest ?? "");
      window.alert(r.ok ? `Withdrawn ${r.amountBnb} BNB to your wallet.\nTx: ${r.txHash}` : `Withdraw failed: ${r.reason ?? "error"}`);
      if (r.ok) onStopped();
    } catch (e) {
      window.alert(`Withdraw failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const deposited = m?.startingCapitalUsd ?? 0;
  const profit = m ? m.equityUsd - deposited : 0;

  return (
    <div className="dashboard">
      <div className="money">
        <div className="money-cell"><div className="metric-label">Deposited</div><div className="money-val">${deposited.toFixed(2)}</div></div>
        <div className="money-arrow">→</div>
        <div className="money-cell"><div className="metric-label">Current value</div><div className="money-val">{m ? `$${m.equityUsd.toFixed(2)}` : "—"}</div></div>
        <div className="money-cell"><div className="metric-label">Profit</div><div className={`money-val ${profit >= 0 ? "up" : "down"}`}>{m ? `${profit >= 0 ? "+" : ""}$${profit.toFixed(2)} (${ret}%)` : "—"}</div></div>
        <div className="spacer" />
        <button className="primary" onClick={withdraw}>Withdraw</button>
      </div>

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

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Price {state?.bestToken ? `· ${state.bestToken}` : ""}</h3>
        <CandleChart token={state?.holding?.[0] ?? state?.bestToken} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Equity curve {state?.holding?.length ? `· holding ${state.holding.join(", ")}` : "· in stable"}</h3>
        <EquityChart points={state?.equityHistory ?? []} baseline={m?.startingCapitalUsd} />
      </div>

      <div className="grid2" style={{ marginBottom: 16 }}>
        {state?.rationale ? (
          <div className="card">
            <h3>AI analyst</h3>
            <p style={{ fontSize: 14 }}>
              {state.rationale}{" "}
              <span className="muted">(sentiment {typeof state.sentiment === "number" ? state.sentiment.toFixed(2) : "—"})</span>
            </p>
          </div>
        ) : (
          <div className="card">
            <h3>AI analyst</h3>
            <p className="muted" style={{ fontSize: 14 }}>Waiting for the first signal read…</p>
          </div>
        )}
        <AgentChat />
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
