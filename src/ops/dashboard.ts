import type { Snapshot } from "./health.ts";

export function renderDashboard(s: Snapshot): string {
  const dd = (s.drawdownPct * 100).toFixed(2);
  const regime = String(s.regime ?? "—");
  const verdict = String(s.verdict ?? "—");
  const ddColor = s.drawdownPct >= 0.18 ? "#c0392b" : s.drawdownPct >= 0.1 ? "#e67e22" : "#27ae60";
  const tickAge = s.lastTickUnix ? `${Math.max(0, Math.floor(Date.now() / 1000) - s.lastTickUnix)}s ago` : "never";
  const scanBase = "https://bscscan.com/address/";

  const m = s.metrics;
  const ret = (m.totalReturnPct * 100).toFixed(2);
  const retColor = m.totalReturnPct >= 0 ? "#27ae60" : "#c0392b";
  const pf = Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞";

  const positions = s.positions
    .map((p) => `<tr><td>${esc(p.token)}</td><td>${p.qtyBase.toFixed(6)}</td><td>$${p.markPxUsd.toFixed(2)}</td><td>$${(p.qtyBase * p.markPxUsd).toFixed(2)}</td></tr>`)
    .join("");

  const ledger = s.ledger
    .map((e) => `<tr><td>${new Date(e.ts * 1000).toISOString().replace("T", " ").slice(0, 19)}</td><td>${esc(e.regime)}</td><td>${esc(e.action)}</td><td>$${e.sizeUsd.toFixed(2)}</td></tr>`)
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="5">
<title>Helios</title>
<style>
  body{font-family:ui-monospace,Menlo,monospace;background:#0e1116;color:#e6edf3;margin:0;padding:24px}
  h1{font-size:18px;margin:0 0 16px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}
  .card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px}
  .label{color:#8b949e;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  .value{font-size:22px;margin-top:6px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #21262d}
  th{color:#8b949e;font-weight:normal}
  a{color:#58a6ff}
  .tag{display:inline-block;padding:2px 8px;border-radius:4px;background:#21262d}
</style></head><body>
<h1>Helios — autonomous trading agent <span class="tag">${esc(String(s.status))}</span> <span class="tag">${esc(verdict)}</span></h1>
<div class="grid">
  <div class="card"><div class="label">Equity</div><div class="value">$${s.equityUsd.toFixed(2)}</div></div>
  <div class="card"><div class="label">High-water</div><div class="value">$${s.highWaterUsd.toFixed(2)}</div></div>
  <div class="card"><div class="label">Drawdown</div><div class="value" style="color:${ddColor}">${dd}%</div></div>
  <div class="card"><div class="label">Total return</div><div class="value" style="color:${retColor}">${ret}%</div></div>
  <div class="card"><div class="label">Realized PnL</div><div class="value">$${m.realizedPnlUsd.toFixed(2)}</div></div>
  <div class="card"><div class="label">Win rate</div><div class="value">${(m.winRate * 100).toFixed(0)}%</div></div>
  <div class="card"><div class="label">Profit factor</div><div class="value">${pf}</div></div>
  <div class="card"><div class="label">Max drawdown</div><div class="value">${(m.maxDrawdownPct * 100).toFixed(2)}%</div></div>
  <div class="card"><div class="label">Trades</div><div class="value">${s.tradeCount}</div></div>
  <div class="card"><div class="label">Regime</div><div class="value">${esc(regime)}</div></div>
  <div class="card"><div class="label">Last tick</div><div class="value">${esc(tickAge)}</div></div>
</div>
<p>Agent wallet: ${s.walletAddress ? `<a href="${scanBase}${esc(s.walletAddress)}">${esc(s.walletAddress)}</a>` : "—"} · ERC-8004 identity: ${s.agentId ? esc(s.agentId) : "not registered"}</p>
<p>Verifiable risk policy: <code>${esc(s.riskPolicyHash)}</code> · Paid signal feed: <code>GET /signal</code> (x402, $0.01 USDC/Base)</p>
<h3>Positions</h3>
<table><thead><tr><th>Token</th><th>Qty</th><th>Mark</th><th>Value</th></tr></thead><tbody>${positions || '<tr><td colspan="4">none</td></tr>'}</tbody></table>
<h3>Recent ledger</h3>
<table><thead><tr><th>Time (UTC)</th><th>Regime</th><th>Action</th><th>Size</th></tr></thead><tbody>${ledger || '<tr><td colspan="4">none</td></tr>'}</tbody></table>
</body></html>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
