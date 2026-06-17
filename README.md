# Helios — Autonomous Trading Agent (BNB Hack, Track 1)

A **deterministic, rule-based finite-state-machine trading agent** for BSC. It senses market signals, decides a target exposure through a fixed three-gear state machine, validates every trade through a hard risk gate, executes on-chain, and writes each decision to an on-chain verifiable ledger — unattended, for the full judged trading week.

It is deliberately **not** an LLM-in-the-loop agent: the decision path is explainable and reproducible, gated by a drawdown circuit-breaker set below the disqualification cap.

## Architecture

```
            ┌──────────────── TypeScript core (Node, daemon) ────────────────┐
 Sense ───▶ Decide ───▶ [Go risk engine] ───▶ Execute ───▶ State ───▶ Record
 (CMC)      (FSM)        (HTTP, stateless)     (TWAK sign)  (SQLite)   (ERC-8004)
            └──────────────────────── Ops: health + heartbeat ───────────────┘
                                                  ▲
                                    [Go watchdog] supervises liveness
```

### Language choices (each region uses the genuinely best tool)
- **TypeScript (Node) core** — daemon loop, chain (ethers), CMC, decide/FSM, execute, record, state. Integration-heavy work where TS has the best SDK coverage and fastest build.
- **Go risk engine** — the DQ spine (drawdown breaker, caps, cost model, cooldown, kill-switch). A **stateless** HTTP service; the core passes a portfolio snapshot + candidate plan and gets back an approve/reject verdict. Isolated, deterministic, exhaustively unit-tested. Every trade must clear it; fail-closed if unreachable.
- **Go watchdog** — standalone static binary that supervises the Node daemon (health/heartbeat poll, auto-restart, alerts). Hands back the single-binary reliability given up by choosing a TS core.
- **TWAK CLI** — transaction signing (self-custody, Trust Wallet Agent Kit), behind a `Signer` interface with native ethers signing as fallback.
- **Python** — optional backtest harness (off the hot path). **Solidity** — only if a custom contract is needed.

Why no language is split badly: trading state lives only in the TS core (SQLite). The Go services are stateless (risk engine) or liveness-only (watchdog), so no source of truth is split across a boundary.

## Repository layout
```
src/                  TypeScript core
  sense/              CMC client -> MarketState (mock provider in paper mode)
  decide/             three-gear FSM -> TradePlan
  risk/               client for the Go risk engine (fail-closed)
  execute/            Signer interface + paper/live executors
  record/             ERC-8004 ledger writer (local in paper mode)
  state/              node:sqlite store: positions, fills, ledger, high-water mark
  ops/                health endpoint + heartbeat
  config/, types/, util/
risk-engine/          Go: stateless risk evaluation service (the DQ spine)
watchdog/             Go: supervisor binary
contracts/abi/        ABIs (PancakeSwap router, ERC-8004 registry)
backtest/             optional Python harness
deploy/               Dockerfile / compose / systemd
config.json           risk-rule config (single source of truth)
docs/resolved.md      resolve-first findings
```

## Run (paper mode)

Requires Node >= 24 (native TypeScript + `node:sqlite`) and Go >= 1.26. For live modes also install the Trust Wallet CLI: `npm i -g @trustwallet/cli`.

```bash
npm install
cp .env.example .env          # fill in CMC + TWAK creds for live modes (not needed for paper)

# terminal 1 — the Go risk engine (DQ spine)
cd risk-engine && go build -o bin/risk-engine . && RISK_ENGINE_ADDR=127.0.0.1:8081 ./bin/risk-engine

# terminal 2 — the agent (paper mode: simulated fills, real marking)
npm start

# optional terminal 3 — the Go watchdog
cd watchdog && go build -o bin/watchdog . && ./bin/watchdog
```

- **Dashboard:** http://127.0.0.1:8080 (live equity, drawdown, positions, ledger)
- **Health:** `curl http://127.0.0.1:8080/health` · **State JSON:** `curl http://127.0.0.1:8080/state`

Modes (in `config.json`): `paper` (simulated execution) → `testnet` → `mainnet` (small real capital). Never jump straight to mainnet. For unattended deployment see `deploy/`.

## Tests & probes
```bash
cd risk-engine && go test ./...   # Go DQ-spine unit tests
npm test                          # TS tests (decide FSM + state accounting)
npm run typecheck                 # TS type checking
npm run sense:probe               # live CMC MarketState (needs CMC key in .env)
npm run swap:probe                # live swap quotes via TWAK (no funds)
```

## How we used each stack
- **CoinMarketCap (the brain):** the agent consumes the CMC **Agent Hub MCP** (`mcp.coinmarketcap.com`). Each tick `CmcSensor` calls `get_global_metrics_latest` (fear-&-greed, altcoin-season, BTC dominance → regime), `get_crypto_technical_analysis` (RSI/MACD/EMA → momentum & trend), `get_global_crypto_derivatives_metrics` (funding/OI → cross-asset pressure) and `get_crypto_quotes_latest` (price + liquidity), normalized into a deterministic `MarketState`.
- **Trust Wallet Agent Kit (the hands):** self-custody autonomous signing. The execute layer shells out to `twak swap` (the agent wallet, no per-tx approval) for quotes and on-chain swaps; the wallet's key never leaves the local keychain.
- **BNB Chain / ERC-8004 (the memory):** the agent registers an on-chain **ERC-8004 identity** via `twak erc8004 register` and writes each decision + realized PnL to it with `set-metadata`, producing a verifiable, auditable track record on BSC.

## Risk rules (declared, enforced)
All limits live in `config.json` and are enforced by the Go risk engine on every trade. The hard drawdown stop (default 25%) sits below the disqualification cap so confirmation latency never breaches it. See `config.json`.

## Status
Fully wired end-to-end: Sense (live CMC) → Decide (FSM + turnover nudge) → Go risk engine (drawdown breaker, caps, cost, cooldown, kill-switch) → Execute (`twak swap`) → State (marked positions, real equity/drawdown) → Record (ERC-8004) → Ops (health, dashboard, alerts, Go watchdog). The drawdown breaker is verified firing on real marked equity (blocks entries, allows flatten). Remaining before the live window: fund the agent wallet for a mainnet small-capital dry run, register via `twak compete`, and confirm the exact contest limits. See `docs/resolved.md`.
