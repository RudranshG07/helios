# Helios — Autonomous, Self-Custody, Verifiable Trading Agent

**Track 1 — Autonomous Trading Agents.** BNB Hack: AI Trading Agent Edition (CoinMarketCap × Trust Wallet × BNB Chain).

> A deterministic, self-custody trading agent that reads CoinMarketCap signals, trades a risk-gated momentum strategy live on BSC through the Trust Wallet Agent Kit, and writes every decision + realized PnL to an on-chain ERC-8004 ledger — engineered to maximize return without ever breaching the drawdown cap, unattended.

## The problem
Markets run 24/7 at machine speed; people can't. The median "AI trading agent" is an LLM that reads sentiment and swaps a token — directional, non-reproducible, weak on risk, and prone to either blowing the drawdown cap or dying unattended. Helios is built for the two things this contest actually rewards: **post a real return, and never get disqualified.**

## What makes Helios different
- **Deterministic finite-state-machine, not an LLM picking trades.** Every decision is explainable, reproducible and auditable (ensemble of CMC regime + technicals + derivatives, with momentum↔mean-reversion regime switching and volatility-targeted sizing). No black-box guessing.
- **The drawdown breaker is an isolated, unit-tested Go service** that every trade must clear (fail-closed), with the hard stop set *below* the DQ cap and an **active flatten** when tripped. Surviving the gate is engineered first.
- **Built to survive the unattended week** — a Go watchdog supervises the process, state is SQLite-persisted (resumes positions + high-water exactly), execution is idempotent (no double-trades on restart), with health/dashboard/alerts.
- **Verifiable + monetizable on-chain identity (the uncontested BNB niche):** an ERC-8004 identity records each decision + PnL + a periodic reputation snapshot; it can sell its signals to other agents via ERC-8183 escrow and an x402 pay-per-call feed.
- **Provably risk-constrained:** the declared risk config is hashed and published on-chain (`riskPolicyHash`), so anyone can verify the limits the agent is bound by.
- **A real product, not a script:** a web app (landing → onboarding → live dashboard) backed by a multi-tenant control plane — each user gets their own self-custody agent behind one shared risk engine.

## How we used each sponsor stack
- **CoinMarketCap (the brain):** consumes the **Agent Hub MCP** (`mcp.coinmarketcap.com`). Each cycle `CmcSensor` calls `get_global_metrics_latest` (fear-&-greed, altcoin-season, BTC dominance → regime), `get_crypto_technical_analysis` (RSI/MACD/EMA → momentum & trend), `get_global_crypto_derivatives_metrics` (funding/OI → cross-asset pressure), `get_crypto_quotes_latest` (price + liquidity), blended into a deterministic `MarketState`. Signals are also re-sold over an **x402** endpoint.
- **Trust Wallet Agent Kit (the hands):** self-custody autonomous signing via `twak swap` (agent-wallet mode, no per-tx approval) with a pre-trade slippage guard. Keys never leave the local keychain.
- **BNB Chain (the memory + commerce):** `twak erc8004` registers the agent identity and writes per-trade records + reputation; `twak erc8183` enables agent-to-agent commerce; `twak compete` registers for the contest. All on BSC.

## Architecture
```
[ Web app (React) ] → [ Control plane ] → per-user [ TS agent runtime ] → [ Go risk engine ]
 landing/onboarding/dashboard   accounts, rules, start/stop, live state    sense→decide→execute→record + ops
```
Languages chosen per region: **TypeScript** for the integration-heavy core (best CMC/TWAK/EVM SDKs), **Go** for the two things that must not fail (the stateless risk engine + the watchdog). **Python** for the backtest. See `README.md`.

## Risk controls (DQ-avoidance, all enforced in code)
Single config object, validated on load, fail-closed. Drawdown breaker (hard stop below the cap) → active flatten; per-token & total exposure caps; max trade size; slippage cap; cooldown; cost model; minimum-trade turnover nudge; runtime kill-switch. The Go engine has a dedicated unit-test suite.

## Validation (backtest)
Replaying the strategy on ~40 days of real BNB hourly data (`backtest/`): **−0.6% vs buy-and-hold −9.7%** (preserved ~9% in a down market), **max drawdown 3.9%** (far under the cap), **45 trades** (above the minimum), confirming the survive-the-gate-and-beat-the-field design.

## On-chain proof
- Agent wallet (BSC): `0x3864b8A47B187fF2829BFf2f74D772811F727Cf7`
- ERC-8004 identity + per-trade ledger: *(populated on first mainnet write)*

## Run it
See `README.md` (product: `control-plane/server.ts` + `web/`) and `GO_LIVE.md` (mainnet checklist). Public, reproducible repo; paper mode needs no keys.

## Status
Feature-complete, tested (Go + TS suites), bug-audited, multi-tenant, and go-live-ready. One funded wallet away from live on-chain trading for Jun 22–28.
