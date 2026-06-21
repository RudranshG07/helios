import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Check, ArrowRight, Menu, X, Cpu, Shuffle, Gauge, ShieldCheck, Fingerprint, FileCheck2 } from "lucide-react";
import { HackathonLive } from "./HackathonLive.tsx";

const VIDEO_A = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4";
const LINKS: { label: string; target: string }[] = [
  { label: "Performance", target: "#performance" },
  { label: "Agent", target: "#features" },
  { label: "How it works", target: "#how" },
  { label: "Docs", target: "docs" },
];
const OPTIONS = ["Maximum return", "Capital preservation", "Steady growth", "My own rules"];
const ACCENT = "#6ee7b7";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] } }),
};

const reveal = { initial: "hidden", whileInView: "visible", viewport: { once: true, amount: 0.2 }, variants: fadeUp } as const;

function useTypewriter(text: string, speed = 38, startDelay = 600) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let i = 0;
    let interval: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [text, speed, startDelay]);
  return { displayed, done };
}

const FEATURES = [
  { icon: Cpu, title: "Deterministic, not a gambling LLM", body: "Every trade is a reproducible, auditable decision from real signals — not a language model guessing. The AI advises; deterministic logic and the risk engine decide." },
  { icon: Shuffle, title: "Rotates into the strongest token", body: "Each cycle it scores a basket of eligible assets and moves into the single strongest — capturing the best mover instead of being stuck in one." },
  { icon: Gauge, title: "Strong-conviction gate", body: "It only deploys when a signal is genuinely strong; otherwise it waits in stable. In backtests this turned a −22% market into a positive return." },
  { icon: ShieldCheck, title: "Isolated risk engine", body: "A separate, unit-tested Go service clears every trade — drawdown breaker, exposure caps, per-trade & daily limits, slippage, cooldown. Fail-closed." },
  { icon: Fingerprint, title: "Self-custody", body: "Connect your own wallet — it's your account, and the agent can only ever return funds to it. Keys never leave you (Trust Wallet Agent Kit)." },
  { icon: FileCheck2, title: "Verifiable on-chain", body: "Decisions, realized PnL, and a reputation snapshot are written to an ERC-8004 identity. Its risk policy is hashed on-chain — verifiable, not claimed." },
];

const STEPS = [
  { n: "01", t: "Sense", d: "Read CoinMarketCap signals — regime, technicals, derivatives, sentiment — across the eligible token universe." },
  { n: "02", t: "Decide", d: "Score each token, rank by conviction, choose the strongest — or stay in stable if none is strong enough." },
  { n: "03", t: "Gate", d: "The Go risk engine validates the trade against every declared limit. No pass, no trade." },
  { n: "04", t: "Execute", d: "Sign & swap on BSC through your self-custody wallet — no per-transaction approval needed." },
  { n: "05", t: "Record", d: "Write the decision + PnL to the on-chain ERC-8004 identity. Loop, 24/7." },
];

export function Landing({ onStart, onDocs }: { onStart: (services?: string[]) => void; onDocs: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const { displayed, done } = useTypewriter("let your capital\ntrade itself.");

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let prevX: number | null = null;
    let target = 0;
    let seeking = false;
    const seek = () => {
      if (seeking || !v.duration) return;
      seeking = true;
      v.currentTime = target;
    };
    const onSeeked = () => {
      seeking = false;
      if (Math.abs(v.currentTime - target) > 0.01) seek();
    };
    const onMove = (e: MouseEvent) => {
      if (window.innerWidth < 1024 || !v.duration) return;
      if (prevX === null) {
        prevX = e.clientX;
        return;
      }
      const delta = e.clientX - prevX;
      prevX = e.clientX;
      target = Math.max(0, Math.min(v.duration, v.currentTime + (delta / window.innerWidth) * 0.8 * v.duration));
      seek();
    };
    v.addEventListener("seeked", onSeeked);
    window.addEventListener("mousemove", onMove);
    if (window.innerWidth < 1024) {
      v.loop = true;
      v.autoplay = true;
      void v.play().catch(() => {});
    }
    return () => {
      v.removeEventListener("seeked", onSeeked);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  const toggle = (s: string) => setServices((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <div className="relative bg-[#0a0b0d] text-[#e9eaec] antialiased overflow-x-hidden" style={{ fontFamily: "var(--font-body)" }}>
      {/* navbar */}
      <header className="fixed top-0 inset-x-0 z-30 px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between bg-gradient-to-b from-[#0a0b0d]/80 to-transparent backdrop-blur-[2px]">
        <div className="flex items-center gap-2.5">
          <span className="text-[22px] sm:text-[26px] tracking-tight font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Helios</span>
          <span className="text-[24px] leading-none" style={{ color: ACCENT }}>✳︎</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
          {LINKS.map((l) => (
            <a key={l.label} href="#" onClick={(e) => { e.preventDefault(); if (l.target === "docs") onDocs(); else document.querySelector(l.target)?.scrollIntoView({ behavior: "smooth" }); }} className="transition-colors hover:text-white">{l.label}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => onStart()} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0a0b0d] transition hover:bg-white/90 active:scale-95">Launch agent</button>
        </div>
        <button className="md:hidden" onClick={() => setMenuOpen(true)} aria-label="menu"><Menu size={24} /></button>
      </header>

      {/* mobile sheet */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div className="fixed inset-0 z-[40] md:hidden" style={{ background: "rgba(8,9,12,0.6)", backdropFilter: "blur(4px)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={() => setMenuOpen(false)} />
            <motion.div className="fixed right-0 top-0 z-[41] flex flex-col p-6 md:hidden" style={{ width: "min(88vw,360px)", height: "100dvh", background: "#101216", boxShadow: "-12px 0 48px rgba(0,0,0,0.5)" }} initial={{ x: "100%" }} animate={{ x: 0, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.45 } }} exit={{ x: "100%", transition: { ease: [0.55, 0, 1, 0.45], duration: 0.35 } }}>
              <div className="flex items-center justify-between">
                <span className="text-[22px] font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Helios</span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><X size={20} /></motion.button>
              </div>
              <div className="my-6 h-px bg-white/10" />
              <div className="flex flex-col gap-1">
                {LINKS.map((l) => (
                  <a key={l.label} href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); if (l.target === "docs") onDocs(); else document.querySelector(l.target)?.scrollIntoView({ behavior: "smooth" }); }} className="rounded-xl px-3 py-2.5 text-[1.1rem] text-white/90 transition hover:bg-white/10">{l.label}</a>
                ))}
              </div>
              <button onClick={() => onStart()} className="mt-auto w-full rounded-full bg-white py-3.5 text-[0.95rem] font-semibold text-[#0a0b0d]">Launch agent</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* hero */}
      <section className="relative flex flex-col lg:block lg:min-h-screen">
        <div className="order-last lg:order-none relative lg:absolute lg:inset-0 lg:z-0 overflow-hidden pointer-events-none w-full aspect-square md:aspect-video lg:aspect-auto lg:h-full">
          <video ref={videoRef} className="w-full h-full object-cover object-right lg:object-right-bottom" style={{ filter: "brightness(0.5) saturate(0.85) grayscale(0.3)" }} src={VIDEO_A} muted playsInline preload="auto" onLoadedData={(e) => (e.currentTarget.currentTime = 0.04)} />
          <div className="hidden lg:block absolute inset-0" style={{ background: "linear-gradient(to right, #0a0b0d 6%, rgba(10,11,13,0.85) 40%, rgba(10,11,13,0.2) 76%, transparent)" }} />
          <div className="lg:hidden absolute inset-0" style={{ background: "linear-gradient(to top, #0a0b0d 14%, rgba(10,11,13,0.2) 72%)" }} />
        </div>

        <div className="relative z-10 flex flex-col order-first lg:order-none w-full pb-8 lg:pb-0 lg:min-h-screen">
          <main className="w-full max-w-7xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
            <div className="max-w-2xl">
              <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp} className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
                <span style={{ color: ACCENT }}>●</span> autonomous · self-custody · verifiable
              </motion.div>
              <motion.h1 custom={1} initial="hidden" animate="visible" variants={fadeUp} className="text-5xl md:text-6xl lg:text-[78px] tracking-tight leading-[1.05] mb-7 select-none whitespace-pre-wrap" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>
                {displayed}
                {!done && <span className="inline-block w-[3px] h-[0.95em] bg-white align-middle ml-[3px] animate-blink" />}
              </motion.h1>
              <motion.p custom={2} initial="hidden" animate="visible" variants={fadeUp} className="text-lg md:text-xl text-white/55 leading-relaxed mb-9 max-w-xl">
                A regime-adaptive, conviction-gated rotation agent — momentum or mean-reversion as the market shifts, deploying only on high conviction, every move risk-bounded and proven on-chain.
              </motion.p>

              <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp} className="mb-10 flex flex-wrap gap-3">
                <button onClick={() => onStart()} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-[#0a0b0d] transition hover:bg-white/90 active:scale-95">
                  Launch your agent <ArrowRight size={17} />
                </button>
                <button onClick={onDocs} className="rounded-full border border-white/15 px-6 py-3.5 text-[15px] font-medium text-white/90 transition hover:bg-white/[0.06]">Read the docs</button>
              </motion.div>

              <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp}>
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/35">What should it optimize for?</p>
                <div className="flex flex-wrap gap-2.5">
                  {OPTIONS.map((opt) => {
                    const active = services.includes(opt);
                    return (
                      <button key={opt} onClick={() => toggle(opt)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${active ? "text-[#0a0b0d]" : "border border-white/12 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"}`} style={active ? { background: ACCENT } : undefined}>
                        {active && <Check size={14} strokeWidth={3} />}
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <AnimatePresence>
                  {services.length > 0 && (
                    <motion.button onClick={() => onStart(services)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 inline-flex items-center gap-2 text-sm font-medium" style={{ color: ACCENT }}>
                      Continue with {services.join(", ")} <ArrowRight size={15} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </main>
        </div>
      </section>

      {/* LIVE HACKATHON PERFORMANCE — right below the hero */}
      <HackathonLive />

      {/* MEET THE AGENT — detailed */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-24 md:py-32">
        <motion.p {...reveal} custom={0} className="text-sm uppercase tracking-[0.25em]" style={{ color: ACCENT }}>The agent</motion.p>
        <motion.h2 {...reveal} custom={1} className="mt-4 max-w-3xl text-3xl md:text-5xl leading-[1.1] tracking-tight" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>
          A trading agent built to survive markets, not just predict them.
        </motion.h2>
        <motion.div {...reveal} custom={2} className="mt-8 grid gap-6 md:grid-cols-2 text-white/60 text-[15px] leading-relaxed">
          <p>
            Most "AI trading agents" are a language model that reads sentiment and fires a swap — directional, non-reproducible, and prone to either blowing up
            or freezing. Helios is the opposite. It's a <span className="text-white">deterministic decision engine</span>: every cycle it pulls
            decision-ready signals from CoinMarketCap, scores a basket of eligible tokens, and rotates into the single strongest — but only when conviction is
            genuinely high. When nothing is strong, it sits in stable and waits. That one rule is why it preserves capital in bad markets and still captures the
            good moves.
          </p>
          <p>
            Underneath, an <span className="text-white">isolated risk engine</span> clears every trade against a drawdown breaker, exposure caps, and daily
            limits — it cannot breach the rules you set. A Claude analyst adds a sentiment read, but it only ever <span className="text-white">advises</span>; the
            deterministic logic and the risk gate decide. And because it runs on the Trust Wallet Agent Kit, it trades from <span className="text-white">your own
            self-custody wallet</span> and writes every decision to a verifiable <span className="text-white">ERC-8004 identity</span> on BNB Chain. You don't
            have to trust the track record — you can audit it.
          </p>
        </motion.div>

        <motion.div {...reveal} custom={3} className="mt-12 grid gap-4 sm:grid-cols-3">
          {[["+8.4%", "backtest return while the market fell −22%"], ["< 10%", "max drawdown — far under the disqualification cap"], ["24/7", "unattended, restart-safe, watchdog-supervised"]].map(([big, small]) => (
            <div key={big} className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <div className="text-3xl" style={{ fontFamily: "var(--font-heading)", fontWeight: 600, color: ACCENT }}>{big}</div>
              <div className="mt-2 text-sm text-white/50">{small}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <motion.h2 {...reveal} className="mb-12 max-w-2xl text-3xl md:text-4xl tracking-tight" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>
          What makes it extraordinary
        </motion.h2>
        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} {...reveal} custom={i % 3} className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <f.icon size={22} style={{ color: ACCENT }} />
              <h3 className="mt-4 text-lg" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>{f.title}</h3>
              <p className="mt-2 text-sm text-white/55 leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <motion.h2 {...reveal} className="mb-12 text-3xl md:text-4xl tracking-tight" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>
          The loop, every cycle
        </motion.h2>
        <div className="grid gap-4 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <motion.div key={s.n} {...reveal} custom={i} className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <div className="font-mono text-xs" style={{ color: ACCENT, fontFamily: "var(--font-mono)" }}>{s.n}</div>
              <div className="mt-2 text-lg" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>{s.t}</div>
              <p className="mt-2 text-[13px] text-white/50 leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* STACK */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        <motion.p {...reveal} className="text-sm uppercase tracking-[0.25em] text-white/40">Built on</motion.p>
        <motion.div {...reveal} custom={1} className="mt-6 grid gap-6 sm:grid-cols-3 text-white/60">
          {[["CoinMarketCap", "Agent Hub — market regime, technicals, derivatives & sentiment via MCP + x402."], ["Trust Wallet", "Agent Kit — self-custody autonomous signing & swaps from your wallet."], ["BNB Chain", "Execution venue + ERC-8004 verifiable identity & reputation."]].map(([t, d]) => (
            <div key={t}>
              <h3 className="text-white" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>{t}</h3>
              <p className="mt-2 text-sm leading-relaxed">{d}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-28 text-center">
        <motion.h2 {...reveal} className="text-4xl md:text-6xl tracking-tight leading-[1.05]" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>
          Your agent. Your rules.<br /><span style={{ color: ACCENT }}>On-chain.</span>
        </motion.h2>
        <motion.div {...reveal} custom={1} className="mt-10 flex justify-center gap-3">
          <button onClick={() => onStart()} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-[15px] font-semibold text-[#0a0b0d] transition hover:bg-white/90 active:scale-95">
            Launch your agent <ArrowRight size={17} />
          </button>
          <button onClick={onDocs} className="rounded-full border border-white/15 px-7 py-4 text-[15px] font-medium text-white/90 transition hover:bg-white/[0.06]">Docs</button>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-white/8 px-6 py-10 text-center text-sm text-white/40">
        <span style={{ fontFamily: "var(--font-heading)" }}>Helios</span> <span style={{ color: ACCENT }}>✳︎</span> · deterministic · self-custody · verifiable
      </footer>
    </div>
  );
}
