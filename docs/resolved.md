# Resolve-First Findings

Live/beta facts that must be verified before wiring the live integrations. Status as of scaffold.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | CMC MCP tool names + response schemas | TODO | Connect to `https://mcp.coinmarketcap.com/mcp` (header `X-CMC-MCP-API-KEY`), list the 12 tools, map which yield regime / risk flags / liquidity / technicals / derivatives. Mirror real field names into `MarketState`. |
| 2 | PancakeSwap router address + ABI (BSC) | TODO | Confirm version (v2/v3/smart router). Pull ABI into `contracts/abi/`. |
| 3 | ERC-8004 registry address + ABI (testnet + mainnet) | TODO | From `bnb-chain/bnbagent-sdk`. Confirm register + write-record interface. |
| 4 | BSC perps venue + contracts | TODO | If unclear/risky, default to spot-only and skip perps. |
| 5 | TWAK signing flow | TODO | Install `curl -fsSL https://agent-kit.trustwallet.com/install.sh | bash`; Access ID/HMAC from portal.trustwallet.com. **Decision: Option B** — sign via TWAK CLI subprocess (native ethers signing is the fallback). Must prove TWAK signs AND broadcasts a real PancakeSwap swap on BSC testnet. |
| 6 | Exact drawdown cap, min trade count, starting capital | TODO | From DoraHacks rules / builder Telegram. Set in `config.json` (currently: 25% hard stop vs ~30% cap, minTradesTarget 30, startingCapitalUsd 1000 — confirm). |

## Decisions locked
- **Core concept:** deterministic rule-based FSM agent (no LLM in decision path).
- **Core language:** TypeScript (Node) — fastest for the integration-heavy build; Go's reliability edge recovered via supervisor + SQLite persistence + idempotent execution.
- **Go regions:** risk engine (DQ spine, stateless service) + watchdog (supervisor binary).
- **Signing:** Option B (TWAK CLI subprocess), native ethers fallback behind a `Signer` interface.

## Built and verified (paper mode)
- Go risk engine: stateless `/evaluate` + `/health`; 12 unit tests covering breaker, kill-switch, caps, slippage, liquidity, cooldown, allowed tokens, warn zone.
- TS core loop: Sense (mock) → Decide (FSM) → risk engine (HTTP, fail-closed) → Execute (paper, cost model) → State (node:sqlite) → Record (local ledger) → Ops (health/heartbeat). Verified end-to-end; cooldown gate observed rejecting re-entry; state persists; graceful shutdown.
- Go watchdog: builds; polls health, restarts on stall via configured supervisor command, alerts.
