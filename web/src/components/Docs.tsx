import type { ReactNode } from "react";

export function Docs({ onBack }: { onBack: () => void }) {
  return (
    <div className="docs">
      <button className="ghost" onClick={onBack} style={{ marginBottom: 20 }}>← Back</button>

      <h1 className="docs-title">Helios documentation</h1>
      <p className="muted" style={{ marginBottom: 28 }}>
        A deterministic, self-custody, on-chain trading agent. It reads the market, decides, executes, and proves itself — autonomously, within the limits you set.
      </p>

      <Section title="How it works">
        Every cycle the agent runs a closed loop: <b>Sense → Decide → Risk gate → Execute → Record</b>. It pulls CoinMarketCap
        signals for a basket of eligible tokens, scores each one, and rotates into the single strongest — but only when conviction is genuinely high; otherwise it
        sits in stable USDT. An isolated risk engine clears every trade before it executes.
      </Section>

      <Section title="The strategy">
        A regime-adaptive ensemble: momentum when a token is trending, mean-reversion when it's ranging, blended with derivatives positioning and an LLM
        sentiment read. Exposure is conviction-weighted. The key rule — <b>only deploy on strong conviction</b> — is what lets it capture moves while preserving
        capital in weak markets.
      </Section>

      <Section title="Risk controls">
        All limits live in one config and are enforced on every trade by a separate Go risk engine (fail-closed):
        <ul>
          <li><b>Drawdown breaker</b> — set below the disqualification cap; flattens to stable when hit.</li>
          <li><b>Exposure caps</b> — total and per-token.</li>
          <li><b>Per-trade & daily notional limits</b>, slippage cap, cooldown.</li>
          <li><b>Kill-switch</b> — pause &amp; flatten anytime.</li>
        </ul>
      </Section>

      <Section title="Self-custody">
        You connect your own wallet — it's your account, and the agent can only ever return funds to it (owner-locked withdraw). The agent signs through the
        Trust Wallet Agent Kit; keys never leave the local keychain. No custodial middleman.
      </Section>

      <Section title="Verifiable on-chain record">
        The agent registers an ERC-8004 identity on BNB Chain and writes its decisions, realized PnL, and a periodic reputation snapshot to it — a tamper-proof
        track record anyone can audit. Its risk policy is hashed and published on-chain, so the limits it's bound by are verifiable, not just claimed.
      </Section>

      <Section title="The stack">
        <ul>
          <li><b>CoinMarketCap Agent Hub</b> — market regime, technicals, derivatives, sentiment (MCP + x402 paid data).</li>
          <li><b>Trust Wallet Agent Kit</b> — self-custody autonomous signing &amp; swaps.</li>
          <li><b>BNB Chain</b> — execution venue + ERC-8004 identity/reputation.</li>
        </ul>
      </Section>

      <Section title="Getting started">
        Connect your wallet → set your risk rules with the sliders → fund the agent wallet → Launch. Watch the live dashboard; pause, resume, or withdraw anytime.
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 18, color: "var(--text)", marginBottom: 10 }}>{title}</h3>
      <div className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
