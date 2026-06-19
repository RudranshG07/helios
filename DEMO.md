# Demo script (2–3 min)

Goal: show the product, a live risk-on → flatten, and the on-chain proof. Practiced run-through.

## Setup (before recording)
```bash
cd web && npm run build && cd ..
( cd risk-engine && go build -o bin/risk-engine . )
node --disable-warning=ExperimentalWarning control-plane/server.ts   # http://localhost:8090
```
Have BscScan open on the agent wallet `0x3864…` for the on-chain tab.

## Script

**[0:00–0:25] Hook + landing.**
"Most AI trading agents are an LLM that reads sentiment and swaps — they blow up or die unattended. Helios is different." Open `localhost:8090` — scrub the hero, scroll to "Trade smarter, risk less, stay in control." One line: *deterministic, self-custody, verifiable.*

**[0:25–0:55] Onboard.**
Click **Launch your agent** → it creates a **self-custody agent wallet** (key stays local). Set risk rules with the sliders — "the hard drawdown stop sits below the disqualification cap, so it de-risks before it can ever breach." Show the **fund** screen (address + balance). Launch.

**[0:55–1:40] Live dashboard.**
Equity, total return, **drawdown**, win-rate, positions, and the **stream of decisions** with regime + verdict. "Every decision is deterministic and explainable — this is the FSM reading CoinMarketCap signals, gated by an isolated Go risk engine." Point out the **risk-policy hash** — "the limits it's bound by are published on-chain; you can verify it, not just trust it."

**[1:40–2:15] The money shot — breaker.**
Hit **Pause & flatten** (or show a drawdown breach in a seeded run): verdict flips to **BREAKER/KILL**, new entries are blocked, and it **actively sells back to stable**. "This is what keeps us out of disqualification — surviving the gate is engineered first."

**[2:15–2:45] On-chain proof + the niche.**
Open BscScan on the agent's **ERC-8004 identity** — per-trade records + reputation snapshot. "A tamper-proof, auditable track record — and it can sell its signals to other agents via ERC-8183 and x402. That's the BNB layer almost no one touches."

**[2:45–3:00] Close.**
"CoinMarketCap for the brain, Trust Wallet for self-custody hands, BNB Chain for verifiable memory — one deterministic agent that posts a return without blowing up, and proves it on-chain." Show the backtest line: **−0.6% vs −9.7% buy-and-hold, 3.9% max drawdown.**
