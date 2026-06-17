# Resolve-First Findings

Live/beta facts that must be verified before wiring the live integrations. Status as of scaffold.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | CMC MCP tool names + response schemas | RESOLVED | Endpoint `https://mcp.coinmarketcap.com/mcp` (header `X-CMC-MCP-API-KEY`), JSON-RPC 2.0, protocol 2025-03-26, stateless (no session id). 12 tools enumerated + mapped below. |
| 2 | PancakeSwap router address + ABI (BSC) | TODO | Confirm version (v2/v3/smart router). Pull ABI into `contracts/abi/`. |
| 3 | ERC-8004 registry address + ABI (testnet + mainnet) | TODO | From `bnb-chain/bnbagent-sdk`. Confirm register + write-record interface. |
| 4 | BSC perps venue + contracts | TODO | If unclear/risky, default to spot-only and skip perps. |
| 5 | TWAK signing flow | TODO | Install `curl -fsSL https://agent-kit.trustwallet.com/install.sh | bash`; Access ID/HMAC from portal.trustwallet.com. **Decision: Option B** — sign via TWAK CLI subprocess (native ethers signing is the fallback). Must prove TWAK signs AND broadcasts a real PancakeSwap swap on BSC testnet. |
| 6 | Exact drawdown cap, min trade count, starting capital | TODO | From DoraHacks rules / builder Telegram. Set in `config.json` (currently: 25% hard stop vs ~30% cap, minTradesTarget 30, startingCapitalUsd 1000 — confirm). |

## CMC MCP tools (12) → MarketState mapping
The 12 tools: `get_crypto_quotes_latest`, `get_crypto_technical_analysis`, `get_crypto_marketcap_technical_analysis`, `get_crypto_metrics`, `get_global_metrics_latest`, `get_global_crypto_derivatives_metrics`, `get_upcoming_macro_events`, `trending_crypto_narratives`, `get_crypto_latest_news`, `search_cryptos`, `search_crypto_info`, `get_crypto_info`.

| MarketState field | Tool(s) | Signal extracted |
|---|---|---|
| `regime` | `get_global_metrics_latest` | fear-&-greed score, altcoin-season gauge, BTC dominance → risk-on/neutral/risk-off |
| `technicals.momentum/.trend` | `get_crypto_technical_analysis` (BNB) | RSI, MACD, SMA/EMA cross |
| `crossAssetPressure` | `get_global_crypto_derivatives_metrics` | funding rates, open interest, BTC liquidations |
| `riskFlags` | derivatives + `get_upcoming_macro_events` + `get_crypto_latest_news` | squeeze risk, imminent macro catalyst, negative news |
| `liquidityUsd` + mark price | `get_crypto_quotes_latest` (BNB) | price + 24h volume (depth proxy) |

**Credit budget note:** Basic plan = 15,000 credits/month, 50 req/min. ~4 tool calls/tick × 5-min ticks ≈ 1,150 calls/day → tune tick interval / cache per-tick, and route ≥1 call via x402 (pay-per-request, also satisfies the x402-usage requirement).

## Credentials / wallet (keys live in .env, gitignored)
- **CMC API key:** validated against `/v1/key/info` — Basic plan, 15,000 credits/month, 50 req/min.
- **TWAK:** Access ID + HMAC secret stored in `.env`.
- **Agent testnet wallet (BSC chainId 97):** `0x1d8436e32eF7C7eB460Ff9c15aAe5F80ab2056Bc` — fund with tBNB from the BNB Chain faucet.

## Decisions locked
- **Core concept:** deterministic rule-based FSM agent (no LLM in decision path).
- **Core language:** TypeScript (Node) — fastest for the integration-heavy build; Go's reliability edge recovered via supervisor + SQLite persistence + idempotent execution.
- **Go regions:** risk engine (DQ spine, stateless service) + watchdog (supervisor binary).
- **Signing:** Option B (TWAK CLI subprocess), native ethers fallback behind a `Signer` interface.

## Built and verified (paper mode)
- Go risk engine: stateless `/evaluate` + `/health`; 12 unit tests covering breaker, kill-switch, caps, slippage, liquidity, cooldown, allowed tokens, warn zone.
- TS core loop: Sense (mock) → Decide (FSM) → risk engine (HTTP, fail-closed) → Execute (paper, cost model) → State (node:sqlite) → Record (local ledger) → Ops (health/heartbeat). Verified end-to-end; cooldown gate observed rejecting re-entry; state persists; graceful shutdown.
- Go watchdog: builds; polls health, restarts on stall via configured supervisor command, alerts.
