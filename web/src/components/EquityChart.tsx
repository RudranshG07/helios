export function EquityChart({ points }: { points: { ts: number; equityUsd: number }[] }) {
  if (!points || points.length < 2) {
    return <div className="muted" style={{ padding: "56px 0", textAlign: "center", fontSize: 13 }}>building equity history…</div>;
  }
  const w = 800;
  const h = 300;
  const pad = 12;
  const vals = points.map((p) => p.equityUsd);
  const dataMin = Math.min(...vals);
  const dataMax = Math.max(...vals);
  const mid = (dataMin + dataMax) / 2;
  // Pad the data range so the line fills ~65% of the height — visible shape,
  // not stretched edge-to-edge. A tiny floor keeps a flat series from dividing by zero.
  const half = Math.max((dataMax - dataMin) / 2, mid * 0.0015) * 1.5 || 1;
  const min = mid - half;
  const range = half * 2;
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / range) * (h - 2 * pad);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.equityUsd).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  const first = vals[0];
  const last = vals[vals.length - 1];
  const up = last >= first;
  const color = up ? "var(--green)" : "var(--red)";
  const chgPct = first > 0 ? ((last - first) / first) * 100 : 0;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 300, display: "block" }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#equityGrad)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ position: "absolute", top: 6, right: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>${dataMax.toFixed(2)}</div>
      <div style={{ position: "absolute", bottom: 6, right: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>${dataMin.toFixed(2)}</div>
      <div style={{ position: "absolute", top: 6, left: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: up ? "var(--green)" : "var(--red)" }}>
        {chgPct >= 0 ? "+" : ""}{chgPct.toFixed(2)}% · ${last.toFixed(2)}
      </div>
    </div>
  );
}
