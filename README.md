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

Requires Node >= 24 (native TypeScript + `node:sqlite`) and Go >= 1.24.

```bash
npm install

# terminal 1 — the Go risk engine (DQ spine)
cd risk-engine && go build -o bin/risk-engine . && RISK_ENGINE_ADDR=127.0.0.1:8081 ./bin/risk-engine

# terminal 2 — the agent (paper mode: no execution, logs decisions)
npm start

# optional terminal 3 — the Go watchdog
cd watchdog && go build -o bin/watchdog . && ./bin/watchdog
```

Health: `curl http://127.0.0.1:8080/health`

Modes (in `config.json`): `paper` (no execution) → `testnet` (real txs, fake value) → `mainnet` (small real capital). Never jump straight to mainnet.

## Tests
```bash
cd risk-engine && go test ./...     # DQ-spine unit tests
npm run typecheck                   # TS type checking
```

## Risk rules (declared, enforced)
All limits live in `config.json` and are enforced by the Go risk engine on every trade. The hard drawdown stop (default 25%) sits below the disqualification cap so confirmation latency never breaches it. See `config.json`.

## Status
Paper-mode loop is fully wired end-to-end (Sense → Decide → Go risk engine → Execute → State → Record → Ops). Live integrations (CMC signals, PancakeSwap execution, TWAK signing, ERC-8004 writes) are pending the resolve-first verification in `docs/resolved.md`.
