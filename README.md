# Helios ✳︎

**A regime-adaptive, conviction-gated rotation agent — momentum or mean-reversion as the market shifts, deploying only on high conviction, every move risk-bounded and proven on-chain.**

Helios is a deterministic, self-custody crypto trading agent running live on BNB Chain. It reads the market, decides, executes, and proves itself — autonomously, within the hard risk limits you set.

---

## What makes it different

Most "AI trading agents" are a language model that reads a headline and fires a swap: directional, non-reproducible, and prone to either blowing up or freezing. Helios is the opposite — a **deterministic decision engine**. Given the same market input it always produces the same decision, and every decision is auditable.

- **Deterministic, not a gambling LLM.** A Claude analyst contributes a sentiment read, but it only ever *advises*; deterministic logic and an isolated risk engine decide and gate.
- **Conviction-gated rotation.** Each cycle it scores a basket of eligible tokens, ranks them by conviction, and rotates into the single strongest — but only when conviction is genuinely high. Otherwise it waits in stable USDT.
- **Regime-adaptive.** Momentum when an asset trends, mean-reversion when it ranges, blended with cross-asset pressure and sentiment.
- **Risk-bounded by design.** A separate, unit-tested Go risk engine clears every trade against a hard drawdown breaker, exposure caps, per-trade and daily limits, slippage, and a cooldown. Fail-closed.
- **Self-custody.** You connect your own wallet; the agent signs through the Trust Wallet Agent Kit and can only ever return funds to you.
- **Verifiable on-chain.** Decisions, realized PnL, and a hashed risk policy are written to an ERC-8004 identity on BNB Chain — auditable, not just claimed.

## How it works

Each cycle runs a closed five-stage loop:

1. **Sense** — pull market signals (regime, technicals, derivatives, sentiment) for the eligible token universe, with a staleness guard.
2. **Decide** — score every token, rank by conviction, choose the strongest, or stay in stable if none clears the gate.
3. **Risk gate** — the Go risk engine validates the trade against every declared limit. No pass, no trade.
4. **Execute** — sign and swap on BSC through your self-custody wallet, with a pre-trade slippage check.
5. **Record** — write the decision and PnL to the on-chain ERC-8004 identity, persist locally, and loop — 24/7.

## Architecture

| Region | Tech | Why |
|---|---|---|
| 24/7 daemon (sense → decide → execute → record) | TypeScript (Node, native TS + `node:sqlite`) | zero native deps, fast to iterate |
| Risk engine | Go, stateless HTTP service | isolated so the safety check can't be skipped by strategy bugs |
| Watchdog | Go | supervises daemon health, auto-restarts |
| Control plane | TypeScript | multi-tenant API; serves the web app, spawns per-user agents |
| Web app | React + Vite | live dashboard, price candles, equity curve, AI chat |
| Backtest harness | Python | validates the strategy on real data before risking capital |

## Run locally

```bash
# risk engine
cd risk-engine && go build -o bin/risk-engine . && RISK_ENGINE_ADDR=127.0.0.1:8081 ./bin/risk-engine

# agent (paper mode — no real funds)
npm start

# tests
npm test
cd risk-engine && go test ./...

# web + control plane (full product on http://localhost:8090)
cd web && npm install && npm run build
node control-plane/server.ts
```

Modes: **paper** (log decisions, no execution) → **testnet** (real txs, fake value) → **mainnet** (small real capital). Mainnet requires an explicit flag.

## Safety

Helios defaults to paper/testnet. It cannot guarantee profit — markets carry risk and gas is a real cost. What it guarantees is that it will never breach the limits you set, that your funds can only return to you, and that its entire record is verifiable on-chain.

---

✳︎ *Let your capital trade itself.*
