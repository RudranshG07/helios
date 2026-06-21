# Deploy: Render (backend) + Vercel (frontend)

Split deploy: the **control plane + agents** run on Render; the **web app** is served fast from Vercel and talks to Render via `VITE_API_BASE`. CORS is already open on the API.

## 1. Backend → Render

The repo has `render.yaml` (a Blueprint). It builds `deploy/Dockerfile` and mounts a 1 GB disk at `/app/data` (so the registry + agent DBs persist).

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → pick the repo. It reads `render.yaml`.
3. Fill the secret env vars (marked `sync: false`) in the Render dashboard:
   `CMC_API_KEY`, `CMC_MCP_API_KEY`, `TWAK_ACCESS_ID`, `TWAK_HMAC_SECRET`,
   `TWAK_WALLET_ADDRESS`, `TWAK_WALLET_PASSWORD`, `FALLBACK_PRIVATE_KEY`,
   `FALLBACK_ADDRESS`, `ANTHROPIC_API_KEY`, `OPS_TOKEN`.
4. Deploy. Note the URL, e.g. `https://helios.onrender.com`.
5. Verify: open `https://helios.onrender.com/api/showcase` — it returns the on-chain proof JSON.

> The `starter` plan stays always-on (needed for a 24/7 agent). The free plan spins down when idle, which pauses the agent — fine for a demo, not for the live trading window.
>
> The flagship mainnet agent signs with the **twak** wallet keystore created locally. To run that exact agent on Render you must migrate the keystore into the container/volume; otherwise run the flagship daemon where the wallet lives and use Render only for the multi-tenant product + dashboard. On-chain proof (wallet, identity, registration) shows regardless of host.

## 2. Frontend → Vercel

`web/vercel.json` configures the Vite build + SPA routing.

1. Vercel → **New Project** → import the repo.
2. Set **Root Directory = `web`** (Vercel auto-detects Vite from there).
3. Add env var **`VITE_API_BASE`** = your Render URL (e.g. `https://helios.onrender.com`), no trailing slash.
4. Deploy. Your public site is the Vercel URL; it calls the Render API for state/chat/showcase.

## 3. After deploy

- Point the X/Twitter profile and links at the Vercel URL.
- Update the ERC-8004 agent URI to the live site:
  `twak erc8004 set-uri 139782 --uri https://<your-vercel-url> --chain bsc`
