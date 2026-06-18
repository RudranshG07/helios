# Go-Live Checklist (Track 1, live window Jun 22–28)

Everything below is ready in code; these are the steps that need the funded wallet.

## 1. Fund the agent wallet (mainnet)
Send mainnet **BNB** to the TWAK agent wallet for gas + a small amount to trade:
```
0x3864b8A47B187fF2829BFf2f74D772811F727Cf7
```
~$10–20 covers gas + a tiny live swap. The wallet is self-custody (key in TWAK keychain / `.env`).

## 2. Confirm the exact contest limits
Verify on the DoraHacks rules page and set in `config.json` → `risk`:
- `hardDrawdownStopPct` (keep BELOW the DQ cap; default 0.25 vs ~0.30)
- `minTradesTarget`, `minTradesPerDay`
- `startingCapitalUsd`

## 3. Switch to mainnet
- **Standalone agent:** set `config.json` `"mode": "mainnet"` and the `chain` block to mainnet (`chainId: 56`, `twakChain: "smartchain"`, `erc8004Chain: "bsc"`, mainnet RPC).
- **Via the product:** the control plane flips the chain automatically when a user selects mainnet.

## 4. Register for the competition
```
twak compete status     # shows deadline 2026-06-25
twak compete register   # registers 0x3864… on BSC (needs gas)
```

## 5. Launch (unattended)
```
docker compose -f deploy/docker-compose.yml up -d --build
# or systemd: see deploy/README.md
```
This runs the risk engine + agent + watchdog with restart-on-crash and persisted state.

## 6. Verify it's live
- Dashboard: `http://<host>:8080` — equity, drawdown, trades climbing, regime/verdict.
- On-chain: ERC-8004 identity registered (agentId on the dashboard) + per-trade metadata on BscScan.
- `twak compete status` → `registered: true`.
- Alerts: set `ALERT_WEBHOOK_URL` (Telegram/Slack) so you're notified of breaker/stall.

## Code readiness (already done & verified)
- Mainnet swap quotes verified via TWAK (`npm run swap:probe`).
- Drawdown breaker → active flatten, verified.
- Idempotent, restart-safe state; watchdog supervises.
- ERC-8004 register + per-trade write + reputation wired (`twak erc8004`).
- Risk policy hash published on-chain (provably risk-constrained).
