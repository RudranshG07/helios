import type { ReactNode } from "react";

const WALLET = "0x3864b8A47B187fF2829BFf2f74D772811F727Cf7";
const PROOF = [
  { label: "Agent wallet", value: `${WALLET.slice(0, 10)}…${WALLET.slice(-6)}`, href: `https://bscscan.com/address/${WALLET}` },
  { label: "ERC-8004 identity", value: "#139782", href: "https://bscscan.com/tx/0x905e74fde4c446bb873df4dabeff40d8e450e93ff415c3968d515f158e110b3d" },
  { label: "On-chain registration", value: "Registered ✓", href: "https://bscscan.com/tx/0x9348e927430a6bf269f3f7afda3c4a4c9d0291656937699bcc02ed7f116941a6" },
];

export function Docs({ onBack }: { onBack: () => void }) {
  return (
    <div className="docs">
      <button className="ghost" onClick={onBack} style={{ marginBottom: 20 }}>← Back</button>

      <h1 className="docs-title">Helios documentation</h1>
      <p className="muted" style={{ marginBottom: 24, fontSize: 15 }}>
        Helios is a deterministic, self-custody, on-chain trading agent — currently running live on BNB Chain. It reads the market, decides, executes,
        and proves itself — autonomously, within the hard limits you set. This page explains exactly how it works, what it's bound by, and how to run it yourself.
      </p>

      <div className="proof-strip">
        {PROOF.map((p) => (
          <a key={p.label} href={p.href} target="_blank" rel="noreferrer" className="proof-chip">
            <span className="proof-label">{p.label}</span>
            <span className="proof-value">{p.value} ↗</span>
          </a>
        ))}
      </div>

      <Section title="What Helios is — and isn't">
        Most "AI trading agents" are a language model that reads a headline and fires a swap: directional, non-reproducible, and prone to either blowing up or
        freezing. Helios is the opposite. It's a <b>deterministic decision engine</b> — given the same market input it always produces the same decision, and every
        decision is auditable. A Claude analyst contributes a sentiment read, but it only ever <b>advises</b>; the deterministic logic and an isolated risk engine
        decide and gate. The result is an agent designed to <b>survive markets, not just predict them</b>.
      </Section>

      <Section title="The loop, every cycle">
        Each tick runs a closed five-stage loop:
        <ul>
          <li><b>Sense</b> — pull CoinMarketCap signals (regime, technicals, derivatives, sentiment) for the eligible token universe, with a staleness guard.</li>
          <li><b>Decide</b> — score every token, rank by conviction, and rotate into the single strongest — or stay in stable if none clears the conviction gate.</li>
          <li><b>Risk gate</b> — a separate Go service validates the trade against every declared limit. No pass, no trade (fail-closed).</li>
          <li><b>Execute</b> — sign &amp; swap on BSC through your self-custody wallet via the Trust Wallet Agent Kit, with a pre-trade slippage check.</li>
          <li><b>Record</b> — write the decision, realized PnL and state hash to the on-chain ERC-8004 identity, persist locally, and loop — 24/7.</li>
        </ul>
      </Section>

      <Section title="The strategy">
        A regime-adaptive ensemble. When a token is trending it weights momentum; when it's ranging it leans mean-reversion; both are blended with cross-asset
        pressure and the LLM sentiment read into a single <b>conviction score</b>. The agent rotates capital into the highest-conviction token — but the decisive
        rule is the <b>conviction gate</b>: it only deploys when a signal is genuinely strong, and otherwise waits in stable USDT. In a multi-asset backtest on real
        market data this gate turned a <b>−22% market into a positive return</b>, because it sidesteps chop and only commits to strong moves.
      </Section>

      <Section title="Risk controls (the guardrails)">
        Every limit lives in one config object, is validated on load, and is enforced on every single trade by a separate, unit-tested Go risk engine. If the
        engine is unreachable, the agent does not trade (fail-closed):
        <ul>
          <li><b>Drawdown breaker</b> — a hard stop set <i>below</i> the disqualification cap; when hit it overrides all strategy logic and flattens to stable.</li>
          <li><b>Exposure caps</b> — total portfolio exposure and per-token concentration limits.</li>
          <li><b>Per-trade &amp; daily notional limits</b> — bound how much can move in one trade and per day.</li>
          <li><b>Slippage cap &amp; cooldown</b> — abort trades with excessive price impact; rate-limit re-entry.</li>
          <li><b>Turnover monitor</b> — nudges trades within risk limits so the minimum trade-count requirement is met.</li>
          <li><b>Kill-switch</b> — pause &amp; flatten everything at any moment, instantly.</li>
        </ul>
      </Section>

      <Section title="The eligible universe">
        The agent trades only an allow-listed set of liquid BSC assets and holds <b>USDT</b> as its stable. The current rotation set is <b>ETH, CAKE, XRP, LINK and UNI</b>
        (Binance-Peg tokens on BNB Chain), each addressed by contract so swaps route reliably through on-chain aggregators. It never touches an asset outside this
        validated, allow-listed universe.
      </Section>

      <Section title="Self-custody">
        You connect your own wallet — it is your account. The agent signs through the Trust Wallet Agent Kit and keys never leave the local keychain; there is no
        custodial middleman. Withdrawals are <b>owner-locked</b>: funds can only ever be returned to the wallet that connected, regardless of what any request
        asks for. Self-custody is the safer design — you stay fully in control of your funds at all times.
      </Section>

      <Section title="Verifiable on-chain record">
        The agent holds a real <b>ERC-8004 identity</b> on BNB Chain (token #139782). It writes its decisions, realized PnL, and a periodic reputation snapshot to
        that identity — a tamper-proof track record anyone can audit. Its entire risk policy is <b>hashed and published on-chain</b>, so the limits it is bound by
        are verifiable, not merely claimed. You don't have to trust the numbers on this site; you can check them against the chain.
      </Section>

      <Section title="Architecture">
        Helios is a hosted app over an autonomous core, choosing the right language per region:
        <ul>
          <li><b>TypeScript core</b> (Node, native TS + <code>node:sqlite</code>, zero native deps) — the 24/7 daemon: sense, decide, execute, record, ops.</li>
          <li><b>Go risk engine</b> — a stateless, unit-tested HTTP service that clears every trade. Isolated so the safety check can't be skipped by strategy bugs.</li>
          <li><b>Go watchdog</b> — supervises daemon health and auto-restarts; reliability is treated as a feature.</li>
          <li><b>Control plane</b> — multi-tenant API that serves this web app, spawns per-user agents, and shares one risk engine.</li>
          <li><b>Python backtest harness</b> — replays the strategy on real market data to validate it before any capital is risked.</li>
        </ul>
      </Section>

      <Section title="The stack">
        <ul>
          <li><b>CoinMarketCap Agent Hub</b> — market regime, technicals, derivatives and sentiment via MCP, plus an x402 paid-data call.</li>
          <li><b>Trust Wallet Agent Kit</b> — self-custody autonomous signing &amp; swaps from your own wallet, plus the ERC-8004 identity.</li>
          <li><b>BNB Chain</b> — the execution venue and the home of the ERC-8004 verifiable identity &amp; reputation record.</li>
        </ul>
      </Section>

      <Section title="Reliability & idempotency">
        Every external call uses a context, timeout and retry/backoff — no naked network calls on the hot path. Execution is idempotent (client-order-id /
        nonce dedupe) so a restart never double-trades, and state is persisted after every fill — a restart resumes positions and the high-water mark exactly.
        Logs are structured JSON correlated by a decision id. It is built to run unattended for the full trading week.
      </Section>

      <Section title="Getting started">
        Connect your wallet → set your risk rules with the sliders (or pick a preset: capital preservation, max return, steady growth) → fund the agent wallet →
        Launch. Then watch the live dashboard — price candles, equity curve, positions, decisions and the AI analyst — and pause, resume or withdraw at any time.
        You can also ask the agent directly, in plain language, why it's doing what it's doing.
      </Section>

      <Section title="Safety & honest limitations">
        Helios defaults to paper/testnet; mainnet requires an explicit flag and small real capital. It cannot guarantee profit — markets carry risk, gas is a real
        cost, and the on-chain register/identity steps spend a small amount of BNB. What it <i>can</i> guarantee is that it will never breach the limits you set, that
        your funds can only return to you, and that its entire record is verifiable on-chain.
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 19, color: "var(--text)", marginBottom: 10 }}>{title}</h3>
      <div className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
