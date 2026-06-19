# Deploying Helios

Three processes run together: the **Go risk engine** (DQ gate), the **TypeScript agent** (the loop), and the **Go watchdog** (supervisor). Pick one of the two paths below.

## Option A — Docker Compose (simplest)

```bash
cp .env.example .env   # fill in CMC + TWAK creds + wallet password
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml logs -f agent
```

- Services talk over the compose network; `deploy/config.docker.json` already points `riskEngine.url` at `risk-engine:8081` and the watchdog at `agent:8080`.
- `restart: always` recovers crashes. The watchdog alerts on stalls (it can't restart a sibling container, so crash-recovery is delegated to Docker).
- Dashboard: http://localhost:8080
- Set `mode` to `testnet`/`mainnet` in `config.docker.json` to go live.

## Option B — systemd on a single VPS (full watchdog-driven restart)

```bash
sudo useradd -r -s /usr/sbin/nologin helios
sudo mkdir -p /opt/helios && sudo cp -r . /opt/helios && sudo chown -R helios /opt/helios
# build the Go binaries to /usr/local/bin
( cd /opt/helios/risk-engine && go build -o /usr/local/bin/risk-engine . )
( cd /opt/helios/watchdog && go build -o /usr/local/bin/watchdog . )
npm i -g @trustwallet/cli
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now helios-risk helios-agent helios-watchdog
```

- Localhost works here, so the default `config.json` URLs are correct.
- Set `watchdog.restartCommand` in `config.json` to `systemctl restart helios-agent` (the watchdog needs permission to run it — run the watchdog unit as root or grant a polkit/sudoers rule).

## Go public (so anyone can use it from a URL)

The app is a normal web product (no terminal for end users): they open the URL, create/fund an agent wallet, set rules, launch, watch earnings, and withdraw. To put it on the internet:

1. **Host the container** on any always-on box (a $5 VPS, Fly.io, Railway, Render). The control plane serves both the web app and the API on one port (8090).
2. **Domain + TLS:** point a domain at it and terminate HTTPS (Caddy is one line: `helios.example.com { reverse_proxy localhost:8090 }`).
3. **Secrets:** set `OPS_TOKEN`, CMC + TWAK creds in the host's env (never in the image).
4. **Funding UX:** users deposit by sending BNB to their agent wallet (shown as address + QR in onboarding); they withdraw to any address from the dashboard.

### The honest part (holding real users' money)
Right now each user's agent wallet key is generated and held **server-side** (custodial). That's the simplest UX but a serious responsibility: for real public funds you need proper key management (HSM/MPC, not a JSON file), security review, withdrawal limits/monitoring, and — depending on jurisdiction — this is regulated activity (custody / money transmission). For the hackathon and demos this flow is complete and works; before taking strangers' real money, treat custody + compliance as a first-class workstream.

## Notes
- Never commit `.env`. Keys are read from the environment at runtime.
- Start in `paper`, graduate to `testnet`, then `mainnet` with small capital.
- `node:sqlite` data persists in the `helios-data` volume (Docker) or `/opt/helios/data` (systemd); restarts resume positions + high-water mark.
