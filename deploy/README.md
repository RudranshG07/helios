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

## Notes
- Never commit `.env`. Keys are read from the environment at runtime.
- Start in `paper`, graduate to `testnet`, then `mainnet` with small capital.
- `node:sqlite` data persists in the `helios-data` volume (Docker) or `/opt/helios/data` (systemd); restarts resume positions + high-water mark.
