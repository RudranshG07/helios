import { useEffect, useState } from "react";

interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
}

export function CandleChart({ token }: { token?: string }) {
  const symbol = `${(token ?? "ETH").toUpperCase()}USDT`;
  const [candles, setCandles] = useState<Candle[]>([]);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setErr(false);
    fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=64`)
      .then((r) => r.json())
      .then((rows: unknown[][]) => {
        if (!alive) return;
        setCandles(rows.map((k) => ({ o: +k[1], h: +k[2], l: +k[3], c: +k[4] })));
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [symbol]);

  if (err) return <div className="muted" style={{ padding: "56px 0", textAlign: "center", fontSize: 13 }}>price feed unavailable</div>;
  if (candles.length < 2) return <div className="muted" style={{ padding: "56px 0", textAlign: "center", fontSize: 13 }}>loading {symbol}…</div>;

  const w = 800;
  const h = 220;
  const pad = 10;
  const hi = Math.max(...candles.map((c) => c.h));
  const lo = Math.min(...candles.map((c) => c.l));
  const range = hi - lo || 1;
  const y = (v: number) => pad + (1 - (v - lo) / range) * (h - 2 * pad);
  const cw = (w - 2 * pad) / candles.length;
  const last = candles[candles.length - 1];
  const first = candles[0];
  const up = last.c >= first.c;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 18 }}>{symbol}</span>
        <span style={{ fontFamily: "var(--font-mono)", color: up ? "var(--green)" : "var(--red)" }}>${last.c.toLocaleString()}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 220, display: "block" }}>
        {candles.map((c, i) => {
          const x = pad + i * cw + cw / 2;
          const green = c.c >= c.o;
          const color = green ? "#6ee7b7" : "#f87171";
          const bodyTop = y(Math.max(c.o, c.c));
          const bodyBot = y(Math.min(c.o, c.c));
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <rect x={x - cw * 0.3} y={bodyTop} width={cw * 0.6} height={Math.max(1, bodyBot - bodyTop)} fill={color} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
