# Deploying Helios

The **control plane is the whole product**: it serves the web frontend (`web/dist`), the API, and spawns/supervises the agents + the Go risk engine — all on one port. So a normal deploy is **one service**.

## Required env (`.env` at repo root)
```
CMC_API_KEY=...            # CoinMarketCap
CMC_MCP_API_KEY=...        # usually same as CMC_API_KEY
TWAK_ACCESS_ID=...         # Trust Wallet Agent Kit
TWAK_HMAC_SECRET=...
TWAK_WALLET_PASSWORD=...   # agent wallet password
ANTHROPIC_API_KEY=...      # Claude analyst (optional)
OPS_TOKEN=...              # protects POST /kill,/resume (set a random string)
# optional:
X402_CMC_URL=             X402_PRIVATE_KEY=
```

---

## Option A — One command (Docker Compose) ✅ recommended
Everything (frontend + API + agents + risk engine) in one container.
```bash
cp .env.example .env        # fill in the values above
docker compose -f deploy/docker-compose.yml up -d --build
# open http://localhost:8090
docker compose -f deploy/docker-compose.yml logs -f
```
State persists in the `helios-data` volume (accounts, positions, equity history) — restarts resume cleanly.

## Option B — A cloud host (Railway / Render / Fly.io)
The container is platform-agnostic; it reads `PORT` from the env (set automatically by these platforms).
1. Push this repo to GitHub.
2. Create a new service from the repo, **Dockerfile path = `deploy/Dockerfile`**.
3. Add the env vars above in the dashboard.
4. Add a **persistent disk/volume mounted at `/app/data`**.
5. Deploy. The platform gives you a public HTTPS URL — that's the live product.

## Option C — Separate frontend + backend
If you want the frontend on a static host (Vercel/Netlify) and the backend elsewhere:
- **Backend:** deploy the control plane (Option A or B) → note its URL, e.g. `https://api.helios.xyz`.
- **Frontend:** deploy `web/` to Vercel/Netlify with build env **`VITE_API_BASE=https://api.helios.xyz`** (the app prefixes all `/api` calls with it; the control plane already sends permissive CORS headers).
  ```bash
  cd web && VITE_API_BASE=https://api.helios.xyz npm run build   # output: web/dist
  ```

## Option D — Single VPS without Docker (systemd)
```bash
# build once
( cd web && npm ci && npm run build )
( cd risk-engine && go build -o bin/risk-engine . )
( cd watchdog && go build -o bin/watchdog . )
npm ci --omit=dev && npm i -g @trustwallet/cli
# run the control plane (serves web + api + spawns agents)
node --disable-warning=ExperimentalWarning control-plane/server.ts
```
Put it behind a domain + TLS with Caddy: `helios.example.com { reverse_proxy localhost:8090 }`.
(`deploy/systemd/*.service` units are also provided for running the standalone single agent.)

---

## Notes
- Never commit `.env`. Set `OPS_TOKEN` so the pause/kill endpoints aren't public.
- Start in `paper`; per-user onboarding flips to `mainnet` (and the chain) when they go live.
- **Custody:** per-user agent keys are currently held server-side. For real public funds this is a custody/security/regulatory responsibility (HSM/MPC, audits) — fine for the hackathon/demo, treat as a first-class workstream before taking strangers' money.
