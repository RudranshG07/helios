export function EquityChart({ points, baseline }: { points: { ts: number; equityUsd: number }[]; baseline?: number }) {
  if (!points || points.length < 2) {
    return <div className="muted" style={{ padding: "56px 0", textAlign: "center", fontSize: 13 }}>building equity history…</div>;
  }
  const w = 800;
  const h = 300;
  const pad = 12;
  const vals = points.map((p) => p.equityUsd);
  // the curve's reference "start" is its first plotted value (or an explicit baseline)
  const base = baseline ?? vals[0];
  const dataMin = Math.min(...vals);
  const dataMax = Math.max(...vals);
  // anchor the y-range to include the start, so the line reads as above (profit)
  // or below (loss) the starting line.
  const lo0 = Math.min(dataMin, base);
  const hi0 = Math.max(dataMax, base);
  const mid = (lo0 + hi0) / 2;
  const half = Math.max((hi0 - lo0) / 2, mid * 0.0015) * 1.3 || 1;
  const min = mid - half;
  const range = half * 2;
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / range) * (h - 2 * pad);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.equityUsd).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  const last = vals[vals.length - 1];
  const ref = base;
  const up = last >= ref;
  const color = up ? "var(--green)" : "var(--red)";
  const chgPct = ref > 0 ? ((last - ref) / ref) * 100 : 0;
  const baseY = y(ref);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 300, display: "block" }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad} x2={w - pad} y1={baseY} y2={baseY} stroke="var(--muted)" strokeWidth="1" strokeDasharray="5 5" opacity="0.5" vectorEffect="non-scaling-stroke" />
        <path d={area} fill="url(#equityGrad)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ position: "absolute", left: 10, top: `${(baseY / h) * 100}%`, transform: "translateY(-50%)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
        start ${ref.toFixed(2)}
      </div>
      <div style={{ position: "absolute", top: 6, right: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: up ? "var(--green)" : "var(--red)" }}>
        {chgPct >= 0 ? "+" : ""}{chgPct.toFixed(2)}% · ${last.toFixed(2)}
      </div>
    </div>
  );
}
