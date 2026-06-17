# CLAUDE.md — Build Driver for **Helios** (BNB Hack Trading Agent)

> **Read this first, then `bnbhack-master-document.md` for full context.** This file tells you (Claude Code) how to build this repo. The master doc is the spec; this is the operating manual + task backlog.

---

## Mission
Build **Helios** *(project codename — rename freely)* — an **autonomous trading agent** for BNB Hack Track 1 that trades live on **BSC** during Jun 22–28 and posts the **highest total return without breaching the max-drawdown cap**. It must use **CMC (signal) + Trust Wallet Agent Kit (execution) + BNB Chain (venue + ERC-8004 identity)**.

## Hard constraints — treat as guardrails in code (DQ = these break)
1. **Max drawdown cap (~30%) = disqualification.** Enforce a hard breaker at a *lower* threshold (default 25%). The breaker overrides all strategy logic and flattens to stablecoin.
2. **Minimum trade count** must be met → design for turnover; add a monitor that nudges trades within risk limits.
3. **Simulated transaction costs** apply → every decision is cost-aware; no destructive churning.
4. **Rule adherence** → all limits live in one config object; every trade passes a validation gate before execution.
5. **On-chain proof** → agent wallet address on BSC + ERC-8004 identity must be real and queryable.
6. Must run **unattended and healthy** for the full trading week → reliability is a feature.

## Strategy (default)
Regime-leveraged momentum (CMC regime + technicals + cross-asset pressure) for return, gated by the drawdown breaker, with every decision + realized PnL written to an **ERC-8004 on-chain ledger** (this also targets the BNB special prize). See master doc §8 (architecture) and §10 (strategy).

---

## Language principle — best tool per region (NOT Go for its own sake)
**Use Go ONLY where it is genuinely the best or clearly-right choice. If another language is better for a region, use that instead.** In a 5-day build, every language seam costs time and bugs, so: **choose ONE primary language for the core loop, and break out to another language only where the benefit clearly beats the integration cost.**

### Honest per-region verdict
| Region | Best tool(s) | Is Go best here? | Use |
|---|---|---|---|
| 24/7 daemon / orchestrator | Go or Rust | **Yes — Go genuinely excellent** | Go |
| BSC chain interaction (RPC, router, registry) | `go-ethereum` (Go) ⟷ ethers/viem (TS) | **Co-best** | match the core language |
| Signing (TWAK / Wallet Core) | TWAK MCP/CLI (language-neutral) | **No** — cgo friction in Go | easiest signing path (TWAK blessed route) |
| CMC signals (Sense) | TS/Python (mature MCP SDKs); REST any-lang | **No** — Go only ties via plain REST | core lang over REST, or thin TS/Python MCP shim |
| Decision / risk engine | Rust (correctness) ⟷ in-process Go/TS | abstract: Rust; 5-day: core lang | in-process with core; Rust only if time |
| Backtest / replay harness | Python (ergonomics) or Rust (speed) | **No** | Python or Rust |
| ERC-8004 record writes | `go-ethereum` (Go) or `bnbagent` (Python) | fine for cohesion, not superior | match core, or Python SDK |
| Custom contracts (if any) | **Solidity** | No | Solidity |
| Dashboard / status page | Go `html/template` or static HTML/TS | fine, not superior | simplest that avoids a new toolchain |

### Core language: **Go** (decided)
Go-core is the genuinely better choice here. The live window is **a week of unattended trading that is directly judged**, and Go's single-binary, goroutine reliability is what survives that. The two regions where Go is normally weaker on this stack have clean Go-friendly escape hatches, so they don't cost you:
- **CMC** → use the plain **REST API** from Go (skip MCP); fully supported, simplest path.
- **Signing** → sign EVM txs **natively with go-ethereum** (secp256k1 + EIP-155), or shell out to the **TWAK CLI/MCP** as a subprocess. Either keeps the TWAK/self-custody narrative without cgo pain.

Break out only where clearly better: **Python** for the backtest harness (and optionally the BNB SDK), **Solidity** for any custom contract, **Rust** for the risk engine only if you have spare time. Everything else stays in the Go core.

Other: **Persistence** SQLite · **Ops** health endpoint, watchdog, alerts · **CMC** include ≥1 x402 call to claim x402 usage.

---

## Proposed repo structure (create stubs, then fill)
*(Example assumes a **Go core**. If you choose TS-core, mirror the same module boundaries in `/src`. Keep `/backtest` in Python/Rust and `/contracts` in Solidity regardless of core.)*
```
/cmd/agent/main.go            # daemon entrypoint, loop, graceful shutdown
/internal/sense/             # CMC client → MarketState (REST/MCP/x402)
/internal/decide/            # policy engine: MarketState → TradePlan (state machine)
/internal/risk/              # drawdown breaker, caps, cost model, trade-count, kill-switch
/internal/execute/           # quote → sign (Wallet Core) → broadcast (go-ethereum) → confirm
/internal/record/            # ERC-8004 identity register + per-trade on-chain write
/internal/state/             # SQLite store: positions, PnL, high-water mark, ledger
/internal/ops/               # health endpoint, heartbeat, alerts, watchdog
/internal/config/            # config load/validate (risk rules JSON)
/internal/chain/             # go-ethereum clients, RPC failover, contract bindings (abigen)
/contracts/abi/              # ABIs: PancakeSwap router, ERC-8004 registry, perps
/risk-engine/                # (optional) Rust crate; gRPC/FFI to Go
/backtest/                   # (optional) Rust replay harness
/deploy/                     # Dockerfile, compose, systemd unit
/dashboard/                  # read-only status page (positions/PnL/drawdown/ledger link)
config.json                  # risk-rule config (see master doc §8.5)
.env.example                 # secrets template
README.md                    # what/architecture/run (also the submission writeup)
```

## Core data contracts (define early in /internal/...)
- `MarketState{ ts, regime, riskFlags[], liquidity{}, technicals{}, crossAssetPressure, stale bool }`
- `TradePlan{ targetExposurePct, trades[]{ token, side, sizeUsd, maxSlippageBps } }`
- `Position{ token, qtyBase, entryPxUsd }`, `Portfolio{ equityUsd, highWaterUsd, drawdownPct }`
- `RiskConfig{ ...see config.json schema in master doc §8.5 }`
- `LedgerEntry{ ts, regime, action, sizeUsd, realizedPnl, stateHash }`

---

## RESOLVE FIRST (Day 1) — do NOT assume these; fetch them live
These are beta/unknown and must be verified before coding the integrations:
1. **CMC MCP tool names + response schemas.** Connect to `https://mcp.coinmarketcap.com/mcp` (header `X-CMC-MCP-API-KEY`) and list the 12 tools; map which tool yields regime / risk flags / liquidity / technicals / derivatives. Mirror real field names into `MarketState`.
2. **PancakeSwap router address + ABI on BSC** (confirm version: v2/v3/smart router). Pull the ABI; generate Go bindings with abigen.
3. **ERC-8004 registry address + ABI** (testnet AND mainnet) from `bnb-chain/bnbagent-sdk`. Confirm the register + write-record interface.
4. **BSC perps venue + contracts** (if doing perps). If unclear/risky, **default to spot-only** and skip perps.
5. **TWAK signing flow:** install `curl -fsSL https://agent-kit.trustwallet.com/install.sh | bash`, get Access ID/HMAC from portal.trustwallet.com, and confirm whether to sign via the TWAK MCP/CLI or via Wallet Core Go binding directly. Wire whichever signs a BSC swap end-to-end fastest.
6. **Exact drawdown cap, min trade count, starting capital** from the DoraHacks rules page / builder Telegram → set them in `config.json`.

Write findings into `/docs/resolved.md` as you go so they're not re-discovered.

---

## Build / run / test (fill commands as you scaffold)
```bash
# Go
go build ./cmd/agent
go test ./...
go run ./cmd/agent --config config.json --mode paper   # paper | testnet | mainnet

# Wallet Core (cgo) — use the prebuilt Docker lib, pin the version
docker run -it trustwallet/wallet-core   # lib prebuilt; reference for cgo flags

# Rust (optional)
cargo build --release        # in /risk-engine and /backtest
cargo test
```
Modes: **paper** (no execution, log decisions) → **testnet** (real txs, fake value) → **mainnet** (small real capital). Never jump straight to mainnet.

## Conventions
- All external calls: context + timeout + retry/backoff. No naked network calls on the hot path.
- Execution must be **idempotent** (client order id / nonce dedupe) so restarts never double-trade.
- One config object is the single source of truth for limits; validate on load; fail closed.
- Structured logging (JSON) with a trade/decision id correlating across modules.
- Persist state after every fill; a restart must resume positions + high-water mark exactly.
- Secrets only via env/keychain; never commit keys. Provide `.env.example`.

---

## Ordered implementation backlog (tickets)
1. Scaffold repo structure + `config.json` + `.env.example` + Go module.
2. **Resolve-first** items 1–6; record in `/docs/resolved.md`.
3. `chain`: go-ethereum client(s) + RPC failover; abigen bindings for router + ERC-8004.
4. `sense`: CMC client → `MarketState` (+ one x402 call) + staleness guard.
5. `decide`: three-gear state machine → `TradePlan` (master doc §8.3).
6. `risk`: validation gate, drawdown breaker, caps, cost model, trade-count monitor, kill-switch.
7. `execute`: quote → sign (Wallet Core/TWAK) → broadcast → confirm; idempotent.
8. `state`: SQLite store; positions, PnL, high-water mark, ledger.
9. `record`: ERC-8004 register + per-trade on-chain write.
10. `ops`: health endpoint, heartbeat, alerts, watchdog/auto-restart.
11. `dashboard`: read-only status page; link to on-chain ledger.
12. End-to-end on **testnet**; then **mainnet** small-capital dry run.
13. Demo video + README "how we used each stack" + DoraHacks submission.
14. (Optional) Rust risk engine + backtest harness.

## Definition of done (submission)
- Public reproducible repo + README (what / architecture / run).
- On-chain proof: BSC agent wallet + ERC-8004 identity address.
- 2–3 min demo: a risk-on→risk-off flatten + the on-chain ledger.
- Uses all three stacks; "how we used each" section.
- Mainnet deployment healthy and ready for Jun 22–28.

## Safety rails (enforce in code AND in operation)
- Default to **paper/testnet**; require an explicit flag for mainnet.
- Hard drawdown breaker below the DQ cap; global kill-switch flag in config.
- Small real capital only. Treat keys as production secrets.
