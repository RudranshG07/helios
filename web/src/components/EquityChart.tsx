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
  // keep the y-axis at least ~6% of the value tall, so a tiny (e.g. 0.5%) move
  // reads as a gentle wiggle instead of being stretched to fill the chart.
  const half = Math.max((dataMax - dataMin) / 2, mid * 0.03) * 1.25 || 1;
  const min = mid - half;
  const range = half * 2;
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / range) * (h - 2 * pad);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.equityUsd).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  const up = vals[vals.length - 1] >= vals[0];
  const color = up ? "var(--green)" : "var(--red)";

  return (
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
  );
}
