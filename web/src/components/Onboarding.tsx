import { useState } from "react";
import { api, getUserId, type RiskRules } from "../api.ts";
import { connectWallet, hasWallet } from "../wallet.ts";

const defaults: RiskRules = {
  maxExposurePct: 0.8,
  maxPositionPctPerToken: 0.25,
  maxTradeSizeUsd: 250,
  hardDrawdownStopPct: 0.25,
  maxSlippageBps: 80,
  cooldownMinutes: 15,
};

function presetRules(preset?: string[]): RiskRules {
  const choice = preset?.[0];
  if (choice === "Capital preservation") return { ...defaults, maxExposurePct: 0.4, hardDrawdownStopPct: 0.12, maxTradeSizeUsd: 150 };
  if (choice === "Maximum return") return { ...defaults, maxExposurePct: 0.9, hardDrawdownStopPct: 0.28, maxTradeSizeUsd: 400 };
  if (choice === "Steady growth") return { ...defaults, maxExposurePct: 0.6, hardDrawdownStopPct: 0.18, maxTradeSizeUsd: 250 };
  return defaults;
}

export function Onboarding({ onLaunched, preset }: { onLaunched: () => void; preset?: string[] }) {
  const [step, setStep] = useState(0);
  const [wallet, setWallet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<RiskRules>(() => presetRules(preset));
  const [capital, setCapital] = useState(1000);
  const [balance, setBalance] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  async function checkBalance() {
    setChecking(true);
    try {
      setBalance((await api.balance()).bnb);
    } catch {
      setBalance(null);
    } finally {
      setChecking(false);
    }
  }

  function copyAddr() {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function startAccount(useWallet: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (getUserId()) {
        setWallet((await api.me()).walletAddress ?? null);
      } else if (useWallet) {
        const addr = await connectWallet();
        if (!addr) throw new Error("no wallet found — install Trust Wallet/MetaMask or continue in demo mode");
        setWallet((await api.connect(addr)).walletAddress);
      } else {
        setWallet((await api.signup()).walletAddress);
      }
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function launch() {
    setBusy(true);
    setError(null);
    try {
      await api.saveConfig({ mode: "mainnet", startingCapitalUsd: capital, risk: rules });
      await api.control("start");
      onLaunched();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wizard">
      <div className="steps">
        {["Wallet", "Risk rules", "Launch"].map((label, i) => (
          <div key={label} className={`step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
            <span className="dot">{i < step ? "✓" : i + 1}</span> {label}
          </div>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {step === 0 && (
        <div className="card pane">
          <h2>Connect your wallet</h2>
          <p className="muted">
            Connect the wallet you control — it becomes your account, and the agent can only ever return funds to it. Helios trades from a dedicated
            agent wallet within the limits you set; you stay in self-custody and can withdraw anytime.
          </p>
          <button className="primary" disabled={busy} onClick={() => startAccount(true)}>
            {busy ? "Connecting…" : hasWallet() ? "Connect wallet" : "Connect wallet (install Trust Wallet/MetaMask)"}
          </button>
          <div style={{ marginTop: 12 }}>
            <button className="ghost" disabled={busy} onClick={() => startAccount(false)}>Continue in demo mode</button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card pane">
          <h2>Set your risk rules</h2>
          <p className="muted">These are enforced on every trade by an isolated risk engine. The agent can never breach them.</p>
          <Slider label="Max portfolio exposure" value={rules.maxExposurePct} min={0.1} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setRules({ ...rules, maxExposurePct: v })} />
          <Slider label="Hard drawdown stop" value={rules.hardDrawdownStopPct} min={0.05} max={0.3} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setRules({ ...rules, hardDrawdownStopPct: v })} />
          <Slider label="Max trade size" value={rules.maxTradeSizeUsd} min={10} max={2000} step={10} fmt={(v) => `$${v}`} onChange={(v) => setRules({ ...rules, maxTradeSizeUsd: v })} />
          <Slider label="Max slippage" value={rules.maxSlippageBps} min={10} max={300} step={10} fmt={(v) => `${v} bps`} onChange={(v) => setRules({ ...rules, maxSlippageBps: v })} />
          <Slider label="Cooldown between entries" value={rules.cooldownMinutes} min={0} max={120} step={5} fmt={(v) => `${v} min`} onChange={(v) => setRules({ ...rules, cooldownMinutes: v })} />
          <Slider label="Starting capital" value={capital} min={100} max={50000} step={100} fmt={(v) => `$${v}`} onChange={setCapital} />
          <div className="row">
            <button className="ghost" onClick={() => setStep(0)}>Back</button>
            <button className="primary" onClick={() => setStep(2)}>Continue</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card pane">
          <h2>Fund &amp; launch</h2>
          {wallet && (
            <div style={{ textAlign: "center", margin: "8px 0 16px" }}>
              <img alt="deposit address QR" width={150} height={150} style={{ borderRadius: 12, background: "#fff", padding: 8 }} src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${wallet}`} />
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>scan to deposit BNB (BSC)</div>
            </div>
          )}
          <div className="kv">
            <span>Agent wallet</span>
            <code style={{ cursor: "pointer" }} onClick={copyAddr} title="copy">{wallet} {copied ? "✓" : "⧉"}</code>
          </div>
          <div className="kv">
            <span>Balance</span>
            <span>
              {balance === null ? "—" : `${balance.toFixed(4)} BNB`}{" "}
              <button className="ghost" style={{ padding: "2px 10px", fontSize: 12 }} onClick={checkBalance}>{checking ? "checking…" : "check"}</button>
            </span>
          </div>
          <p className="muted">Send BNB (gas + the capital you want it to trade) to the address above on BSC, then launch. Self-custody — you can withdraw anytime.</p>
          <div className="kv"><span>Starting capital</span><span>${capital}</span></div>
          <div className="kv"><span>Max exposure</span><span>{Math.round(rules.maxExposurePct * 100)}%</span></div>
          <div className="kv"><span>Drawdown stop</span><span>{Math.round(rules.hardDrawdownStopPct * 100)}%</span></div>
          <div className="kv"><span>Max trade</span><span>${rules.maxTradeSizeUsd}</span></div>
          <p className="muted">Once launched, the agent trades autonomously within these rules. Pause or stop it anytime from the dashboard.</p>
          <div className="row">
            <button className="ghost" onClick={() => setStep(1)}>Back</button>
            <button className="primary" disabled={busy} onClick={launch}>{busy ? "Launching…" : "Launch agent →"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="slider">
      <div className="slider-head">
        <span>{props.label}</span>
        <strong>{props.fmt(props.value)}</strong>
      </div>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </div>
  );
}
