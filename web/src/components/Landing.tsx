import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Check, ArrowRight, ArrowRightCircle, Zap, ShieldCheck, Fingerprint, Menu, X } from "lucide-react";

const VIDEO_A = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4";
const VIDEO_B = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260606_131516_eca35265-ea66-4fbd-8d52-22aae6e1a503.mp4";
const LINKS = ["How it works", "Performance", "Security", "Docs"];
const OPTIONS = ["Maximum return", "Capital preservation", "Steady growth", "My own rules"];
const ACCENT = "#00ff2b";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] } }),
};

const iconStyle = { color: "#00ff2b", display: "inline", verticalAlign: "middle", position: "relative", top: -2, margin: "0 6px" } as const;

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

export function Landing({ onStart }: { onStart: (services?: string[]) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgRef = useRef<HTMLVideoElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const { displayed, done } = useTypewriter("let your capital\ntrade itself.");

  // section 1 video: desktop mouse scrub, mobile autoplay
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

  useEffect(() => {
    bgRef.current?.play().catch(() => {});
  }, []);

  const toggle = (s: string) => setServices((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <div className="relative bg-[#000000] text-white font-sans antialiased overflow-x-hidden selection:bg-[#00ff2b]/40">
      {/* shared navbar */}
      <header className="fixed top-0 inset-x-0 z-30 px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[21px] sm:text-[26px] tracking-tight font-medium select-none">Helios&reg;</span>
          <span className="text-[25px] sm:text-[30px] select-none tracking-[-0.02em] font-medium leading-none mb-1" style={{ color: ACCENT }}>&#10033;</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/85">
          {LINKS.map((l) => (
            <a key={l} href="#" className="transition-opacity hover:opacity-70">{l}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => onStart()} className="rounded-full px-5 py-2.5 text-sm font-semibold text-black transition hover:shadow-lg active:scale-95" style={{ background: ACCENT }}>Launch agent</button>
          <button onClick={() => onStart()} className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/15 active:scale-95">Sign in</button>
        </div>
        <button className="md:hidden" onClick={() => setMenuOpen(true)} aria-label="menu"><Menu size={24} /></button>
      </header>

      {/* mobile sheet */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div className="fixed inset-0 z-[40] md:hidden" style={{ background: "rgba(7,9,13,0.55)", backdropFilter: "blur(4px)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={() => setMenuOpen(false)} />
            <motion.div className="fixed right-0 top-0 z-[41] flex flex-col p-6 md:hidden" style={{ width: "min(88vw,360px)", height: "100dvh", background: "#11161f", boxShadow: "-12px 0 48px rgba(0,0,0,0.5)" }} initial={{ x: "100%" }} animate={{ x: 0, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.45 } }} exit={{ x: "100%", transition: { ease: [0.55, 0, 1, 0.45], duration: 0.35 } }}>
              <div className="flex items-center justify-between">
                <span className="text-[22px] font-medium">Helios&reg;</span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><X size={20} /></motion.button>
              </div>
              <div className="my-6 h-px bg-white/10" />
              <div className="flex flex-col gap-1">
                {LINKS.map((l, i) => (
                  <motion.a key={l} href="#" onClick={() => setMenuOpen(false)} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0, transition: { delay: 0.18 + i * 0.07, duration: 0.4 } }} className="rounded-xl px-3 py-2.5 text-[1.1rem] text-white/90 transition hover:bg-white/10">{l}</motion.a>
                ))}
              </div>
              <div className="mt-auto flex flex-col gap-3">
                <button onClick={() => onStart()} className="w-full rounded-full py-3.5 text-[0.95rem] font-semibold text-black" style={{ background: ACCENT }}>Launch agent</button>
                <button onClick={() => onStart()} className="w-full rounded-full bg-white/10 py-3.5 text-[0.95rem] font-semibold">Sign in</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* SECTION 1 — typewriter + optimize pills (mouse-scrub video) */}
      <section className="relative flex flex-col lg:block lg:min-h-screen">
        <div className="order-last lg:order-none relative lg:absolute lg:inset-0 lg:z-0 overflow-hidden pointer-events-none w-full aspect-square md:aspect-video lg:aspect-auto lg:h-full">
          <video ref={videoRef} className="w-full h-full object-cover object-right lg:object-right-bottom" style={{ filter: "brightness(0.55) saturate(0.9)" }} src={VIDEO_A} muted playsInline preload="auto" onLoadedData={(e) => (e.currentTarget.currentTime = 0.04)} />
          <div className="hidden lg:block absolute inset-0" style={{ background: "linear-gradient(to right, #000000 6%, rgba(7,9,13,0.88) 38%, rgba(7,9,13,0.25) 74%, transparent)" }} />
          <div className="lg:hidden absolute inset-0" style={{ background: "linear-gradient(to top, #000000 12%, rgba(7,9,13,0.2) 70%)" }} />
        </div>

        <div className="relative z-10 flex flex-col order-first lg:order-none w-full pb-8 lg:pb-0 lg:min-h-screen">
          <main className="w-full max-w-7xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
            <div className="max-w-2xl">
              <motion.h1 custom={0} initial="hidden" animate="visible" variants={fadeUp} className="text-5xl md:text-6xl lg:text-[76px] font-normal tracking-tight leading-[1.08] mb-8 select-none whitespace-pre-wrap">
                {displayed}
                {!done && <span className="inline-block w-[2px] h-[1.1em] bg-white align-middle ml-[2px] animate-blink" />}
              </motion.h1>

              <motion.p custom={1} initial="hidden" animate="visible" variants={fadeUp} className="text-lg md:text-xl text-white/60 leading-relaxed mb-10 max-w-2xl">
                Helios reads the market, decides, and trades on-chain — <br className="hidden sm:block" />
                autonomously, within the hard risk limits you set.
              </motion.p>

              <motion.div custom={2} initial="hidden" animate="visible" variants={fadeUp}>
                <h2 className="text-2xl font-medium tracking-tight mb-1">What should Helios optimize for?</h2>
                <p className="text-white/45 mb-6">Select all that apply — you can change it anytime.</p>
                <div className="flex flex-wrap gap-2.5">
                  {OPTIONS.map((opt) => {
                    const active = services.includes(opt);
                    return (
                      <motion.button key={opt} onClick={() => toggle(opt)} whileTap={{ scale: 0.96 }} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-medium transition-colors ${active ? "text-black shadow-md" : "bg-white/5 text-white/85 border border-white/15 hover:bg-white/10"}`} style={active ? { background: ACCENT } : undefined}>
                        {active && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                            <Check size={15} strokeWidth={3} />
                          </motion.span>
                        )}
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  {services.length === 0 ? (
                    <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} className="italic text-xs mt-5 text-white/50">
                      Tap to choose how Helios should trade.
                    </motion.p>
                  ) : (
                    <motion.div key="active" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm text-white/80">
                          Helios will optimize for: <strong className="text-white">{services.join(", ")}</strong>
                        </span>
                        <button onClick={() => onStart(services)} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide transition-all hover:gap-3" style={{ color: "#00ff2b" }}>
                          Let's go <ArrowRight size={15} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </main>
        </div>
      </section>

      {/* SECTION 2 — centered inline-icon hero (looping video) */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <video ref={bgRef} className="absolute inset-0 z-0 h-full w-full object-cover" style={{ filter: "brightness(0.42) saturate(0.85)" }} src={VIDEO_B} autoPlay muted loop playsInline preload="auto" />
        <div className="absolute inset-0 z-0" style={{ background: "radial-gradient(900px 600px at 50% 18%, rgba(0,255,43,0.2), transparent 60%), linear-gradient(to bottom, rgba(7,9,13,0.7), rgba(7,9,13,0.6) 50%, rgba(7,9,13,0.95))" }} />
        <div className="relative z-10 mx-auto max-w-[680px] px-6 text-center">
          <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }} custom={0} variants={fadeUp} className="font-extrabold" style={{ fontSize: "clamp(2.1rem,6vw,4rem)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            <span className="whitespace-nowrap">
              Trade<Zap size={32} style={iconStyle} />smarter, risk<ShieldCheck size={32} style={iconStyle} />less
            </span>
            <br />
            stay fully<Fingerprint size={32} style={{ ...iconStyle, marginLeft: 8 }} />in control
          </motion.h2>
          <motion.p initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }} custom={1} variants={fadeUp} className="mx-auto mt-6 max-w-[560px] text-white/75" style={{ fontSize: "clamp(0.95rem,2.5vw,1.15rem)", lineHeight: 1.65 }}>
            Self-custody, verifiable, always on. Every decision and realized PnL is written on-chain — a tamper-proof track record you and anyone can audit.
          </motion.p>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }} custom={2} variants={fadeUp} className="mt-9 flex justify-center">
            <motion.button onClick={() => onStart()} whileHover={{ scale: 1.04, filter: "brightness(1.1)" }} whileTap={{ scale: 0.96 }} className="flex items-center justify-between gap-8 font-semibold text-black" style={{ background: ACCENT, borderRadius: 50, padding: "17px 24px", minWidth: 210, boxShadow: "0 4px 24px rgba(0,255,43,0.4)" }}>
              Launch your agent <ArrowRightCircle size={20} />
            </motion.button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
