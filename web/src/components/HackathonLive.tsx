import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, ShieldCheck, Repeat, Trophy, ExternalLink, Wallet, Fingerprint, CircleDollarSign } from "lucide-react";
import { api, type Showcase } from "../api.ts";
import { EquityChart } from "./EquityChart.tsx";

const ACCENT = "#6ee7b7";
const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.2 }, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } as const;

function short(tx: string): string {
  return `${tx.slice(0, 8)}…${tx.slice(-6)}`;
}

export function HackathonLive() {
  const [s, setS] = useState<Showcase | null>(null);

  useEffect(() => {
    const poll = () => api.showcase().then(setS).catch(() => {});
    poll();
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, []);

  const m = s?.metrics;
  const capital = m ? m.equityUsd : 10.95;
  const ret = m ? (m.totalReturnPct * 100) : 0;
  const trades = m ? m.tradeCount : 0;
  const winRate = m ? Math.round(m.winRate * 100) : 0;
  const dd = m ? (m.maxDrawdownPct * 100) : 0;
  const pnl = m ? m.realizedPnlUsd : 0;
  const trading = (s?.live && trades > 0) === true;

  const stats = [
    { icon: TrendingUp, label: "Total return", value: `${ret >= 0 ? "+" : ""}${ret.toFixed(2)}%`, tone: ret >= 0 ? "up" : "down" },
    { icon: CircleDollarSign, label: "Realized PnL", value: `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`, tone: pnl >= 0 ? "up" : "down" },
    { icon: Repeat, label: "Trades", value: String(trades), tone: "" },
    { icon: Trophy, label: "Win rate", value: `${winRate}%`, tone: "" },
    { icon: ShieldCheck, label: "Max drawdown", value: `${dd.toFixed(2)}%`, tone: "" },
    { icon: Wallet, label: "Capital under management", value: `$${capital.toFixed(2)}`, tone: "" },
  ];

  const proofs = [
    { icon: Trophy, label: "On-chain registration", value: "Registered ✓", href: `https://bscscan.com/tx/${s?.registerTx}` },
    { icon: Fingerprint, label: "ERC-8004 identity", value: `#${s?.agentId ?? "139935"}`, href: `https://bscscan.com/address/${s?.wallet ?? ""}` },
    { icon: Wallet, label: "Agent wallet", value: s ? `${s.wallet.slice(0, 6)}…${s.wallet.slice(-4)}` : "0x3864…7Cf7", href: `https://bscscan.com/address/${s?.wallet ?? ""}` },
  ];

  return (
    <section id="performance" className="relative z-10 border-t border-white/8 bg-[#0c0d10]">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <motion.div {...fade} className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: ACCENT }} />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} />
          </span>
          <p className="text-sm uppercase tracking-[0.25em]" style={{ color: ACCENT }}>{trading ? "Currently running · live agent" : "Live agent · on-chain"}</p>
        </motion.div>

        <motion.h2 {...fade} className="mt-4 max-w-3xl text-3xl md:text-5xl leading-[1.1] tracking-tight" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>
          Our <span style={{ color: ACCENT }}>live agent</span>, running right now
        </motion.h2>
        <motion.p {...fade} className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/55">
          Our flagship agent is registered, self-custody, and verifiable on BNB Chain — every number below is read live from its on-chain wallet and ledger.
          {!trading && " The agent is live and preparing its first cycle; metrics populate the moment it trades."}
        </motion.p>

        {/* on-chain proof badges */}
        <motion.div {...fade} className="mt-8 grid gap-3 sm:grid-cols-3">
          {proofs.map((p) => (
            <a key={p.label} href={p.href} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5 transition hover:border-white/20 hover:bg-white/[0.04]">
              <p.icon size={18} style={{ color: ACCENT }} />
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-white/40">{p.label}</div>
                <div className="truncate text-sm text-white/90" style={{ fontFamily: "var(--font-mono)" }}>{p.value}</div>
              </div>
              <ExternalLink size={13} className="ml-auto text-white/25 transition group-hover:text-white/60" />
            </a>
          ))}
        </motion.div>

        {/* chart + stats */}
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <motion.div {...fade} className="lg:col-span-3 rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="text-lg" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>Equity curve</h3>
              <span className="text-sm" style={{ fontFamily: "var(--font-mono)", color: ret >= 0 ? ACCENT : "#f87171" }}>${capital.toFixed(2)}</span>
            </div>
            {s && s.equityHistory.length >= 2 ? (
              <EquityChart points={s.equityHistory} baseline={m?.startingCapitalUsd} />
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center">
                <div className="text-white/40 text-sm">Equity curve builds as the agent trades</div>
                <div className="text-white/25 text-xs">Starting capital ${capital.toFixed(2)} USDT · drawdown breaker at 15%</div>
              </div>
            )}
          </motion.div>

          <motion.div {...fade} className="lg:col-span-2 grid grid-cols-2 gap-3 content-start">
            {stats.map((st) => (
              <div key={st.label} className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                <st.icon size={18} className="text-white/40" />
                <div className="mt-3 text-2xl tracking-tight" style={{ fontFamily: "var(--font-heading)", fontWeight: 600, color: st.tone === "up" ? ACCENT : st.tone === "down" ? "#f87171" : "#fff" }}>{st.value}</div>
                <div className="mt-1 text-xs text-white/45">{st.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* edge factors */}
        <motion.div {...fade} className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Capital preservation first", "A hard 15% drawdown breaker flattens to stable before losses ever approach the disqualification cap — survival is the strategy."],
            ["Conviction-gated rotation", "It only deploys into the single strongest token when the signal is genuinely strong; otherwise it waits in stable, sidestepping chop."],
            ["Verifiable, not claimed", "Decisions, PnL and a hashed risk policy are written on-chain to an ERC-8004 identity — judges can audit the record, not just trust it."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <h4 className="text-[15px]" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>{t}</h4>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{d}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
