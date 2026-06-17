# Resolve-First Findings

Live/beta facts that must be verified before wiring the live integrations. Status as of scaffold.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | CMC MCP tool names + response schemas | RESOLVED | Endpoint `https://mcp.coinmarketcap.com/mcp` (header `X-CMC-MCP-API-KEY`), JSON-RPC 2.0, protocol 2025-03-26, stateless (no session id). 12 tools enumerated + mapped below. |
| 2 | PancakeSwap router address + ABI (BSC) | RESOLVED (N/A) | Not needed — `twak swap` routes via aggregators (0x / LiquidMesh) and handles the router internally. We call `twak swap --usd <size> <from> <to> --chain <key>`. Spot-only on the WBNB/USDT pair (CAKE needs a contract address; deferred). |
| 3 | ERC-8004 registry address + ABI (testnet + mainnet) | RESOLVED | `twak erc8004` has built-in known deployments for `bsc` and `bsctestnet` (override via `ERC8004_REGISTRY_ADDRESS` for other chains). Wired: `register` (mint identity) + `set-metadata` (per-trade ledger write) + `show`. |
| 4 | BSC perps venue + contracts | RESOLVED (decision) | Default to **spot-only** via `twak swap`. Perps skipped for reliability. |
| 5 | TWAK signing flow | RESOLVED (creds) | CLI is the npm pkg `@trustwallet/cli` (v0.19.1, binary `twak`, needs Node ≥22.14). Creds verified working: `twak price BNB` made a successful authenticated call (raw hand-rolled HMAC got 403 — use the CLI/SDK, not raw signing). Env vars: `TWAK_ACCESS_ID`/`TWAK_HMAC_SECRET`. CLI exposes `swap` (Option-B execution), `erc8004` (our ledger), `wallet`, and `compete` (hackathon register/status). Agent wallet created headless (`--no-keychain`, password in `.env` `TWAK_WALLET_PASSWORD`). **Open issue:** CLI throws `could not register testnet node for smartchain-testnet (cid97)` — a v0.19.1 proxy bug; need a workaround for BSC-testnet swaps (mainnet smartchain, native-ethers fallback, or CLI upgrade). Swap signing on testnet still to be proven end-to-end. |

### TWAK API signing (for reference, if ever calling raw)
Base `https://tws.trustwallet.com`. Sign `METHOD+PATH+QUERY+ACCESS_ID+NONCE+DATE` (no separators) with HMAC-SHA256 → base64. Headers: `X-TW-Credential`, `X-TW-Nonce`, `X-TW-Date`, `Authorization`. Prefer the CLI/SDK which sign correctly.
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
- **CMC API key:** validated against `/v1/key/info` — Basic plan, 15,000 credits/month, 50 req/min. Live `CmcSensor` built + verified (real BNB price/regime/technicals).
- **TWAK:** Access ID + HMAC secret stored in `.env`, verified working via CLI.
- **Agent wallet (PRIMARY, TWAK-managed, BSC chainId 97 + mainnet 56):** `0x3864b8A47B187fF2829BFf2f74D772811F727Cf7` — **this is the address to fund with tBNB.**
- **Fallback wallet (native ethers signer only):** `0x1d8436e32eF7C7eB460Ff9c15aAe5F80ab2056Bc` (key in `.env` `FALLBACK_PRIVATE_KEY`).

## Decisions locked
- **Core concept:** deterministic rule-based FSM agent (no LLM in decision path).
- **Core language:** TypeScript (Node) — fastest for the integration-heavy build; Go's reliability edge recovered via supervisor + SQLite persistence + idempotent execution.
- **Go regions:** risk engine (DQ spine, stateless service) + watchdog (supervisor binary).
- **Signing:** Option B (TWAK CLI subprocess), native ethers fallback behind a `Signer` interface.

## Built and verified (paper mode)
- Go risk engine: stateless `/evaluate` + `/health`; 12 unit tests covering breaker, kill-switch, caps, slippage, liquidity, cooldown, allowed tokens, warn zone.
- TS core loop: Sense (mock) → Decide (FSM) → risk engine (HTTP, fail-closed) → Execute (paper, cost model) → State (node:sqlite) → Record (local ledger) → Ops (health/heartbeat). Verified end-to-end; cooldown gate observed rejecting re-entry; state persists; graceful shutdown.
- Go watchdog: builds; polls health, restarts on stall via configured supervisor command, alerts.
- Execute layer wired to `twak swap` (`src/execute/twak.ts` + `TwakExecutor`): real quotes verified via `npm run swap:probe` (USDT↔WBNB through 0x/LiquidMesh, no funds). Live broadcast still needs tBNB + the cid97 testnet-node fix.
- Record layer wired to `twak erc8004` (`src/record/erc8004.ts` + `Erc8004Recorder`): registers identity once (cached in state `agentId`), writes per-trade `set-metadata`. Funding-gated (mint + writes cost gas).
- Chain keys differ per CLI command: swap uses `smartchain`/`smartchain-testnet`; erc8004 uses `bsc`/`bsctestnet`. Both in `config.json` (`chain.twakChain`, `chain.erc8004Chain`).
- **Live PnL/position marking (DQ spine now functional):** the store models all holdings (incl. the stable) as marked positions; equity is computed from live marks each tick; `applyFill` updates both legs; `markPrices`/`refreshHighWater` run before and after trades. Drawdown is now real and feeds the Go engine. **Verified end-to-end:** equity moved on mark, drawdown crossed thresholds OK→WARN→BREAKER, and on BREAKER the daemon blocked new buys while approving flatten sells. Accounting math unit-checked (buy→price drop→drawdown→sell-all).

## `cid97` bug + competition (resolve-first follow-ups)
- **`cid97` testnet-node error is cosmetic** — printed to stderr only; JSON results parse fine from stdout. The TS wrappers read stdout separately, so they're already robust. CLI is latest (0.19.1); no upgrade fixes it. Just ignore the stderr line.
- **`twak compete`** works: `status` shows wallet `0x3864…` **not yet registered**, registration **open until 2026-06-25** (CLI-authoritative; differs from the master doc's Jun-21 lock — verify exact dates). `register` needs the funded wallet (on-chain tx).
- **Testnet swap friction:** `twak swap` can't resolve symbols like `USDT` on `smartchain-testnet` (needs contract addresses). The competition trades on **mainnet** anyway, so the execution-proof path is a **tiny mainnet swap** (small real capital), not testnet. Mainnet quotes already verified working.
