# BNB Hack: AI Trading Agent Edition — Master Build Document (v2, expanded)

**Project codename: Helios** *(rename freely)*

*Complete researched reference: project context, rules, judging criteria, full tech stack, detailed architecture,  language strategy, and our winning plan. Track 1.*

---

## 0. TL;DR

- **Event:** BNB Hack: AI Trading Agent Edition — CoinMarketCap × Trust Wallet × BNB Chain. $36,000 total.
- **We enter:** Track 1 — Autonomous Trading Agents ($24,000 pool, 5 winners).
- **Win condition:** trade live on BSC during Jun 22–28 and post the **highest total return without breaching a max-drawdown cap (~30% = disqualification)**, meeting a **minimum trade count**, **net of simulated costs**. "Most profit without blowing up."
- **Controllable second prize:** the three $2,000 **special prizes** are human-judged on craft/novelty and **stack** with the main prize.
- **Our design:** aggressive-but-gated regime/momentum agent (return engine + hard drawdown circuit-breaker) + an **ERC-8004 on-chain verifiable track record** for a special prize. Two shots, one build.
- **Languages:** **Go-core** (decided — best for the judged unattended week). Go for the daemon + EVM execution; CMC via REST, signing native/TWAK CLI. Break out only where clearly better: Python (backtest/BNB SDK), Solidity (contracts), Rust (risk engine if time). See §9.
- **Hard deadline:** Submission lock **Jun 21, 12:00 UTC**.

---

## 1. Project context & strategic read (researched)

**Why this hackathon exists.** The three sponsors are assembling a production "autonomous trading agent stack" and want builders to prove it end-to-end before the playbook is public. The thesis they repeat: markets run 24/7 and move at machine speed, but individual users can't act with precision — agents close that gap by reading data, deciding, and executing on-chain with minimal human input. Each sponsor owns one layer and wants their layer showcased:

- **CoinMarketCap** wants agents consuming the **CMC Agent Hub** — pre-computed, decision-ready signals (market regime, liquidity, ETF demand, cross-asset pressure, risk flags) instead of raw JSON.
- **Trust Wallet** wants to prove **self-custody autonomous execution** — an AI acting on a wallet where keys never leave the user.
- **BNB Chain** wants agents using **BSC as the venue** and ideally the **BNBAgent SDK** (on-chain identity + trustless agent commerce).

**What this means for us.** Judges reward agents that make each sponsor layer look good *and necessary*. The required minimum is one sponsor capability; using all three scores highest. The least-contested special prize is BNB's (almost nobody will touch ERC-8004/8183), which is exactly why our differentiator lives there.

**The competitive landscape.** The median submission will be "LLM reads sentiment → swaps a token." It will trade directionally, have weak risk controls, and use only CMC + a basic swap. We beat that on two axes the rules actually reward: a **return engine gated by a hard drawdown breaker** (so we post a number without getting disqualified), and a **real on-chain artifact** (the verifiable ledger) that reads as "technical execution + originality" to the panel.

---

## 2. The hackathon at a glance

| Item | Detail |
|---|---|
| Organizers | BNB Chain, CoinMarketCap (CMC), Trust Wallet |
| Total prize pool | $36,000 |
| Tracks | Track 1: Autonomous Trading Agents · Track 2: Strategy Skills |
| Registration | https://dorahacks.io/hackathon/bnbhack-twt-cmc/ |
| Builder Telegram | https://t.me/+MhiOLT0YUnlmNWFk |
| Eligibility | Any builder, solo or team, **18+**; must ship a working agent |
| Sponsor requirement | **At least one** capability required; **all three score highest** |

---

## 3. Timeline (UTC)

| Phase | Window | Notes |
|---|---|---|
| Registration opens | Jun 3, 12:00 | DoraHacks |
| Build phase | Jun 3 – Jun 21 | Weekly mentor office hours |
| **Submission lock** | **Jun 21, 12:00** | **Hard cutoff** |
| Live trading window (Track 1) | Jun 22 – Jun 28 | Held-out window, real conditions, **unattended** |
| Judging | Jun 29 – Jul 5 | Live PnL replay + panel |
| Winners announced | Week of Jul 6 | Co-published by all 3 partners |

> Two-stage for Track 1: **submit by Jun 21**, then the agent **trades live Jun 22–28**, then it's **judged**. It must run unattended and stay healthy for the entire trading week — ops reliability is a first-class requirement, not an afterthought.

---

## 4. Prize structure

**Track 1 — Autonomous Trading Agents ($24,000, 5 winners):** 1st $10,000 · 2nd $6,000 · 3rd $4,000 · 4th $2,000 · 5th $2,000.

**Track 2 — Strategy Skills ($6,000, 3 winners):** 1st $3,000 · 2nd $2,000 · 3rd $1,000.

**Special prizes ($2,000 each, $6,000 total):**
- Best Use of CoinMarketCap Data & Signal (funded by CMC)
- Best Use of Trust Wallet Agent Kit (funded by Trust Wallet)
- Best Use of BNB AI Agent SDK (funded by BNB Chain)

Special prizes **stack** with a main placement — one team can win both.

**Non-cash:** CMC Pro API credits · Claude API compute · 1 mentor per finalist team · BNB Kickstart eligibility · Trust Wallet Developer Portal listing.

---

## 5. Judging criteria — the decisive section

### 5.1 Track 1 (objective, performance-ranked)
Agent runs against a **held-out market window after submission lock**, scored on:
1. **Total return** — primary ranking metric (highest net return wins).
2. **Max drawdown cap (gate)** — breach (~30%) → **disqualified**, regardless of return. A gate, not the score.
3. **Risk-adjusted performance** — factored in.
4. **Rule adherence** — stay within declared limits.
5. **Minimum trade count** — too few trades → disqualified.
6. **Simulated transaction costs** — applied to returns; over-churning is penalized.

**Strategic reading:** the cap is generous, so **maximize return under the gate** — do not minimize risk. A low-return "safe" agent cannot win the main pool. Win = *most profit without blowing up*, enough trades, after costs.

### 5.2 Track 2 + all special prizes (discretionary panel)
- **Technical execution** — does it work; is the on-chain piece real, not cosmetic?
- **Originality** — a new take on a real problem?
- **Real-world relevance** — clear user, plausible adoption path?
- **Demo & presentation** — clear demo and overview?

---

## 6. Criteria we MUST match (master checklist)

**Disqualification-avoidance (Track 1):**
- [ ] Trades **live on BSC** during Jun 22–28 (real, on-chain)
- [ ] **Max drawdown under the cap** (~30%; confirm exact) — hard circuit-breaker
- [ ] **Minimum trade count met** — sufficient turnover by design
- [ ] Returns **net of simulated costs** — cost-aware sizing
- [ ] **Rule adherence** throughout
- [ ] **On-chain proof:** agent wallet address on BSC
- [ ] Submitted **before Jun 21, 12:00 UTC**
- [ ] Uses **at least one** sponsor capability

**Score maximizers:**
- [ ] Uses **all three** stacks (CMC + TWAK + BNB)
- [ ] Public, **reproducible** repo + clean README
- [ ] Real on-chain component (not cosmetic)
- [ ] Novel angle (ERC-8004 ledger) → originality + BNB special prize
- [ ] 2–3 min demo video (behavior + on-chain proof)
- [ ] "How we used each stack" writeup

---

## 7. The tech stack — full detail (researched)

### 7.1 L1 — CMC Agent Hub (Data & Signal) → the brain
| Path | Detail |
|---|---|
| **MCP server** | `https://mcp.coinmarketcap.com/mcp`; header `X-CMC-MCP-API-KEY`; key from `pro.coinmarketcap.com`. **12 tools** spanning: live price/quotes, market sentiment, technical-analysis signals, on-chain metrics, derivatives data, trending narratives/news, fuzzy search. |
| **Pre-computed signals** | market regime, liquidity, ETF demand, cross-asset pressure, risk flags — compact, LLM-friendly. This is the decision fuel. |
| **REST API** | The classic Pro API still works for custom backends (any language). Endpoint overview in the docs. |
| **x402** | Keyless pay-per-request: **$0.01 USDC/request on Base (chain 8453)**, pay-on-success, off-chain signed auth; also an MCP endpoint with automatic per-request payment. Use ≥1 x402 call to claim x402 usage. |
| **CMC CLI** | Open source (`coinmarketcap-official/CoinMarketCap-CLI`); JSON/table/CSV, dry-run, live polling monitor. |
| **Skills Marketplace** | `find_skill` smart routing; 190+ reusable skills; open source (`coinmarketcap-official/skills-for-ai-agents`). |
| Docs | `pro.coinmarketcap.com/api/documentation/ai-agent-hub` |
| Note | Beta; expanding to multi-market DEX + on-chain data across ETH, SOL, BNB. |

### 7.2 L2 — Trust Wallet Agent Kit / TWAK (Custody & Execution) → the hands
| Item | Detail |
|---|---|
| **Install** | `curl -fsSL https://agent-kit.trustwallet.com/install.sh | bash` |
| **Credentials** | Access ID + HMAC Secret from `portal.trustwallet.com`; saved to `~/.twak/` + OS keychain |
| **Agent wallet mode** | Dedicated wallet, rules upfront, **autonomous signing, no per-tx approval** — built for DCA/limit/price-triggered. **The mode we use.** |
| **WalletConnect mode** | Agent proposes, user approves each tx (not for our autonomous case) |
| **Access** | CLI + MCP; auto-wires Claude Code, Cursor, etc. |
| **Reach** | Self-custody local signing across **30+ chains**, native x402 |
| **Wallet Core** | Crypto library: HD wallets, address derivation, **tx signing**; bindings for **Swift, Kotlin, TypeScript, Go, Rust, WASM** across 130+ chains; Barz ERC-4337 smart wallet |
| **Agent skills** | `trustwallet/tw-agent-skills` (open source) |

### 7.3 L3 — BNB AI Agent SDK / bnbagent-sdk (Chain, Identity & Commerce) → the memory/identity
**Not a trading library** — an agent **identity + commerce** stack. Trading venue (PancakeSwap, BSC perps) is reached via signing + direct contract calls.

| Item | Detail |
|---|---|
| **Language / install** | Python. `pip install bnbagent`; `pip install "bnbagent[server]"` (FastAPI/Uvicorn ERC-8183 server); IPFS extra available |
| **ERC-8004 identity** | Persistent on-chain identity + **trackable reputation** — basis for our verifiable ledger |
| **ERC-8183 commerce** | First live implementation. Contracts: **AgenticCommerce** (kernel: job state + escrow), **EvaluatorRouter** (binds job→policy; also `job.evaluator`/`job.hook`), **OptimisticPolicy** (silence past dispute window = approval). `settle(jobId)` is permissionless |
| **Disputes** | UMA Optimistic Oracle / Data Verification Mechanism |
| **Funds** | BNB native stablecoin `$U` + supported tokens |
| **Status** | Live on BSC testnet; mainnet coming |
| **Repo / docs** | `bnb-chain/bnbagent-sdk`; BSC docs `docs.bnbchain.org` |
| **Venue** | BSC mainnet, PancakeSwap (spot), PancakeSwap/BSC perps |

> **Key insight:** all three sponsor pieces are ultimately HTTP endpoints + Solidity contracts on an EVM chain. That means **any language with an HTTP client and an EVM library can drive the whole stack** — you are not locked into Python/TS. This is what makes the Go/Rust plan in §9 viable.

---

## 8. Detailed architecture

### 8.1 Component diagram
```
                       ┌───────────────────────────────────────────┐
                       │          AGENT DAEMON  (Go, 24/7)          │
                       │   stateful · restart-safe · single binary  │
                       └───────────────────────────────────────────┘
                          │            │             │           │
            ┌─────────────▼──┐ ┌───────▼──────┐ ┌────▼──────┐ ┌──▼───────────┐
            │   SENSE        │ │   DECIDE      │ │ EXECUTE   │ │  RECORD      │
            │ CMC signals    │ │ policy engine │ │ swaps /   │ │ ERC-8004     │
            │ via REST/MCP/  │ │ + RISK GATE   │ │ perps on  │ │ identity:    │
            │ x402           │ │ (Rust core)   │ │ BSC       │ │ decision+PnL │
            └────────────────┘ └───────────────┘ └───────────┘ └──────────────┘
                    │                  │                │              │
            ┌───────▼────────┐  ┌──────▼───────┐  ┌─────▼──────┐  ┌────▼───────┐
            │ MarketState    │  │ target       │  │ TWAK sign  │  │ go-ethereum│
            │ (normalized)   │  │ exposure +   │  │ (Wallet    │  │ contract   │
            │ + staleness    │  │ trade plan   │  │ Core Go) + │  │ write      │
            │ guard          │  │              │  │ go-ethereum│  │            │
            └────────────────┘  └──────────────┘  └────────────┘  └────────────┘
                                       │
                            ┌──────────▼───────────┐
                            │   RISK OVERLAY        │  drawdown breaker, position
                            │   (always-on)        │  caps, trade-count, cost model,
                            │                      │  global kill-switch → stable
                            └──────────────────────┘
                                       │
                            ┌──────────▼───────────┐
                            │  STATE STORE (SQLite) │  positions, PnL, high-water
                            │  + structured logs    │  mark, trade ledger, config
                            └──────────────────────┘
                                       │
                            ┌──────────▼───────────┐
                            │  OPS: health endpoint,│  Telegram/webhook alerts,
                            │  watchdog, dashboard  │  auto-restart, heartbeat
                            └──────────────────────┘
```

### 8.2 Module responsibilities
| Module | Responsibility | Notes |
|---|---|---|
| **Sense** | Poll CMC each cycle; normalize into `MarketState`; timestamp + staleness guard | Never trade on stale data |
| **Decide** | Map `MarketState` → target net exposure + concrete trade plan; pure/deterministic | Explainable; optional LLM narration for demo only |
| **Risk overlay** | Enforce drawdown gate, position caps, cooldown, trade-count target, cost model; owns the kill-switch | The DQ-avoidance layer; runs before every trade and continuously |
| **Execute** | Quote → slippage check → size → sign → broadcast → confirm | TWAK agent-wallet signing; go-ethereum for router/perp calls |
| **Record** | Write `{ts, regime, action, sizeUsd, realizedPnl, stateHash}` to ERC-8004 identity | Hash full context off-chain; key metrics on-chain |
| **State store** | Persist positions, realized/unrealized PnL, high-water mark, trade ledger, config | SQLite; survives restarts mid-window |
| **Ops** | Health endpoint, watchdog/auto-restart, heartbeat, alerts, read-only dashboard | The unattended-week reliability layer |

### 8.3 Decision state machine (three gears)
```
            risk-on & no flags & DD<gate
   ┌──────────────────────────────────────────┐
   │                                          ▼
[NEUTRAL] ──risk-on──▶ [RISK-ON: long basket, sized by signal]
   ▲  ▲                         │
   │  │   regime weakens /      │  risk flag OR DD approaching gate
   │  └── flag clears ──────────┘
   │                            ▼
   └────────────────────── [RISK-OFF: flatten to stablecoin / hedge]
                                  ▲
              hard drawdown breach│ (forced, overrides everything)
                                  │
                            [KILL-SWITCH → stable, halt new entries]
```
Transitions are driven by CMC regime + risk flags **and** the live drawdown vs the gate. The drawdown breaker can force RISK-OFF/KILL from any state.

### 8.4 One trading cycle (sequence)
1. **Tick** (every N minutes) → Sense pulls CMC signals; build `MarketState`; staleness check.
2. **Decide** computes target exposure + candidate trades from the state machine.
3. **Risk overlay** validates each candidate against rules (size caps, slippage, cooldown, projected drawdown, cost). Reject → log reason.
4. **Execute** approved trades: quote, sign via TWAK/Wallet Core, broadcast through BSC RPC, await confirmation.
5. **Update state**: positions, realized PnL, high-water mark, drawdown.
6. **Record** the decision + outcome to ERC-8004.
7. **Ops**: emit heartbeat; alert on anomalies; sleep to next tick.

### 8.5 Risk-rule schema (declared + enforced)
```json
{
  "maxExposurePct": 0.80,
  "maxPositionPctPerToken": 0.25,
  "maxTradeSizeUsd": 250,
  "hardDrawdownStopPct": 0.25,
  "drawdownWarnPct": 0.18,
  "minTradesTarget": 30,
  "minLiquidityUsd": 250000,
  "maxSlippageBps": 80,
  "perTradeCostBps": 30,
  "cooldownMinutes": 15,
  "allowedTokens": ["WBNB", "USDT", "CAKE"],
  "stableAsset": "USDT",
  "killSwitch": false
}
```
Set `hardDrawdownStopPct` comfortably **below** the disqualification cap (e.g. 25% vs a 30% cap) so confirmation latency never pushes you over.

### 8.6 Deployment & 24/7 operations (critical for Jun 22–28)
- Single binary/container (a Go core gives a single static binary; a TS core a Node service) in Docker on a small always-on VPS or systemd unit. Fewer artifacts = trivial deploy + restart.
- **Watchdog + auto-restart**; persistent state so a restart resumes positions, PnL, and high-water mark exactly.
- **Heartbeat + alerts** (Telegram/webhook) so you know within minutes if it stalls.
- **Idempotent execution**: dedupe by client order id / nonce so a restart never double-trades.
- **RPC redundancy**: 2+ BSC RPC endpoints with failover.
- **Read-only dashboard** for judges/yourself: live positions, PnL, drawdown, trade count, on-chain ledger link.

### 8.7 Failure modes & mitigations
| Failure | Mitigation |
|---|---|
| CMC API down/stale | Staleness guard → hold/flatten, never trade on stale data |
| RPC failure | Multi-RPC failover; retry with backoff |
| Tx stuck/underpriced | Gas bump + replace-by-fee; timeout → re-quote |
| Slippage spike | Pre-trade slippage check; abort if > cap |
| Drawdown approaching gate | Warn threshold → de-risk early; hard stop well below cap |
| Process crash | Watchdog restart + persisted state + idempotent execution |
| Too few trades near deadline | Trade-count monitor nudges turnover within risk limits |

---

## 9. Language strategy — best tool per region

**Principle: use Go ONLY where it is genuinely the best or clearly-right choice. Where another language is better for a region, use that.** In a 5-day build every language seam costs time and bugs, so **pick ONE primary language for the core loop and break out only where the benefit clearly beats the integration cost.**

Why polyglot is even possible: every sponsor surface is HTTP + EVM. CMC is REST/MCP over HTTP; Trust Wallet **Wallet Core** has official Go, Rust, TS and WASM bindings (and the TWAK MCP/CLI path is language-neutral); the BNB ERC-8004/8183 pieces are Solidity contracts on BSC callable from any EVM library (`go-ethereum`, `ethers`/`viem`, `alloy`/`ethers-rs`). So you are not locked into any one language — which is exactly why you should choose per region rather than by preference.

### 9.1 Honest per-region verdict
| Region | Best tool(s) | Is Go best here? | Use |
|---|---|---|---|
| 24/7 daemon / orchestrator | Go or Rust | **Yes — Go genuinely excellent** (single binary, goroutines, crash-resilient) | Go |
| BSC chain interaction (RPC, router, registry) | `go-ethereum` (Go) ⟷ `ethers`/`viem` (TS) | **Co-best** | match the core language |
| Signing (TWAK / Wallet Core) | TWAK MCP/CLI (language-neutral) | **No** — Go path needs cgo + native lib | easiest signing path (TWAK blessed route) |
| CMC signals (Sense) | TS/Python (mature MCP SDKs); REST any-lang | **No** — Go only ties via plain REST | core lang over REST, or thin TS/Python MCP shim |
| Decision / risk engine | Rust (correctness) ⟷ in-process Go/TS | abstract: Rust; under 5-day pressure: core lang | in-process with core; Rust only if time allows |
| Backtest / replay harness | Python (data ergonomics) or Rust (speed) | **No** | Python or Rust |
| ERC-8004 record writes | `go-ethereum` (Go) or `bnbagent` (Python) | fine for cohesion, not superior | match core, or Python SDK |
| Custom contracts (if any) | **Solidity** | No | Solidity |
| Dashboard / status page | Go `html/template` or static HTML/TS | fine, not superior | simplest that avoids a new toolchain |

### 9.2 Core language: **Go** (decided)
Go-core is the genuinely better choice for this build — not a preference. The live window is **a week of unattended trading that is directly judged**, and Go's single-binary, goroutine reliability is exactly what survives it (a Node process dying or leaking unnoticed mid-week could wreck PnL or trade count → DQ). The two regions where Go is normally weaker on this stack have clean escape hatches that keep you in Go:
- **CMC** → use the plain **REST API** from Go (skip MCP) — fully supported, simplest.
- **Signing** → sign EVM txs **natively with go-ethereum** (secp256k1 + EIP-155) or shell out to the **TWAK CLI/MCP** — keeps the TWAK/self-custody narrative without cgo friction.

(TS-core would only win for a JS-first builder optimizing pure integration speed.) Break out only where clearly better: **Python** for the backtest harness and optionally the BNB SDK; **Solidity** for any custom contract; **Rust** for the risk engine only if time allows. Everything else stays in the Go core.

### 9.3 Practical notes / gotchas
- If you go Go-core and use Wallet Core, it needs the prebuilt native lib via cgo — use the official `trustwallet/wallet-core` Docker image and pin the version. If cgo friction is high under time pressure, sign EVM txs natively (secp256k1 + EIP-155) instead; using the TWAK route still gives the Trust Wallet special-prize narrative.
- If you break out a Rust risk engine, keep it behind a stable interface (gRPC or C ABI) so the core stays the single source of truth for state — don't split state across a language boundary.
- Don't add a language for a region where it isn't clearly better; cohesion wins in a 5-day build.
- Confirm the exact BSC perps venue/contracts before committing perps; spot-only on PancakeSwap is the safe fallback.

---

## 10. Recommended winning strategy

**Regime-Leveraged Momentum Agent + drawdown circuit-breaker + ERC-8004 verifiable ledger.**

- **Return engine:** ride risk-on momentum aggressively (CMC regime + technicals + cross-asset pressure), sized for a real return number; optional perps leverage when signals are strong.
- **Drawdown gate:** hard breaker set below the cap (e.g. 25% vs 30%) — flatten before breaching. Surviving the gate is mandatory.
- **Trade-count + cost logic:** meet minimum turnover without cost-destroying churn.
- **Verifiable ledger:** write each decision + PnL to the ERC-8004 identity — auditable proof targeting the BNB special prize + "technical execution/originality."

**Two shots, one build:** competes for the **$10k main pool** and independently targets a **$2k special prize**, so a bad market week doesn't zero you out.

**Fallback ladder:** drop perps → spot-only momentum ↔ stablecoin; drop ERC-8183 escrow → keep ERC-8004 record; drop basket → single liquid pair (WBNB/USDT) with regime gating. Always protect the core loop.

---

## 11. Five-day execution plan (today = Jun 16)

- **Day 1 (Jun 16) — Setup + de-risk.** CMC key, TWAK Access ID/HMAC, BSC testnet funds. Validate: TWAK/Wallet Core signs a PancakeSwap swap from Go; CMC returns usable regime/risk fields; ERC-8004 identity registers + accepts a record. **Decide perps in/out.**
- **Day 2 (Jun 17) — Sense + Decide.** CMC poller → `MarketState`; momentum policy + drawdown/trade-count/cost rules (Rust engine if doing Go+Rust); paper mode.
- **Day 3 (Jun 18) — Execute.** Wire swaps (+perps if in), sizing, breaker, kill-switch; full testnet end-to-end; restart-safe + idempotent.
- **Day 4 (Jun 19) — Record + go live small.** ERC-8004 registration + per-trade writer; dashboard/README; mainnet with small capital; dry live run overnight + alerts.
- **Day 5 (Jun 20) — Harden + submit.** Watchdog, edge cases, 2–3 min demo video, DoraHacks BUIDL writeup. Buffer before **Jun 21 12:00 UTC**. Then it runs Jun 22–28.

---

## 12. Submission requirements checklist
- [ ] DoraHacks BUIDL submission before the lock
- [ ] Public repo + clean README (what/architecture/run)
- [ ] **Reproducible** (judges can run/verify)
- [ ] **On-chain proof:** agent wallet address on BSC (+ ERC-8004 identity address)
- [ ] 2–3 min demo video (gear-switch + on-chain ledger)
- [ ] "How we used each stack" section
- [ ] Declared risk-rule config (rule adherence)
- [ ] Mainnet deployment healthy for Jun 22–28

---

## 13. Risks, rules & legal
- **Real money risk:** agents act on-chain and can incur real loss. Use small capital.
- **Third-party services at own risk:** BNB Chain disclaims warranties/liability for third-party services; contact the provider for malfunctions.
- **Prizes discretionary on quality:** organizers may withhold if standards aren't met.
- **Multi-track:** allowed, but each submission needs its own working agent; we focus on Track 1.
- **Beta software:** CMC Agent Hub, TWAK, and the BNB SDK are all beta — budget time for breakage and pin versions.

---

## 14. Key links
| Resource | URL |
|---|---|
| Hackathon (DoraHacks) | https://dorahacks.io/hackathon/bnbhack-twt-cmc/ |
| Hackathon (CMC) | https://coinmarketcap.com/api/hackathon/ |
| Builder Telegram | https://t.me/+MhiOLT0YUnlmNWFk |
| CMC Agent Hub docs | https://pro.coinmarketcap.com/api/documentation/ai-agent-hub |
| CMC MCP endpoint | https://mcp.coinmarketcap.com/mcp |
| Trust Wallet Portal | https://portal.trustwallet.com/ |
| TWAK install | `curl -fsSL https://agent-kit.trustwallet.com/install.sh | bash` |
| Wallet Core (Go/Rust bindings) | https://github.com/trustwallet/wallet-core |
| Wallet Core Go server-side guide | https://developer.trustwallet.com/developer/wallet-core/integration-guide/server-side |
| tw-agent-skills | https://github.com/trustwallet/tw-agent-skills |
| BNB AI Agent SDK | https://github.com/bnb-chain/bnbagent-sdk |
| BSC developer docs | https://docs.bnbchain.org |
| go-ethereum | https://geth.ethereum.org/docs |
| PancakeSwap docs | https://docs.pancakeswap.finance |

---

*Verify the exact drawdown threshold, minimum trade count, starting capital, and any KYC/payout terms directly on the DoraHacks rules page and in the builder Telegram — these specifics govern disqualification, and all sponsor tools are in beta and may have changed since this was compiled.*
