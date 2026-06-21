#!/usr/bin/env bash
# Helios local keep-alive supervisor:
#  - prevents the Mac from sleeping (caffeinate)
#  - keeps the Go risk engine and the agent running, auto-restarting either on crash
# Run:  bash deploy/keepalive.sh   (leave the Mac plugged in, lid open)
set -u
ROOT="/Users/rudranshg/helios"
cd "$ROOT" || exit 1
set -a; [ -f .env ] && . ./.env; set +a
export PATH="$HOME/.local/go/bin:$PATH"
KLOG=/tmp/helios-keepalive.log
echo "$(date) keepalive starting" >> "$KLOG"

# 1) stop sleep (idle); lid must stay open
pkill -x caffeinate 2>/dev/null
caffeinate -dimsu &
CAFF=$!

# 2) clear any existing instances so ports are free
pkill -f "risk-engine/bin/risk-engine" 2>/dev/null
pkill -f "src/index.ts" 2>/dev/null
sleep 2

# 3) supervise the risk engine
(
  while true; do
    RISK_ENGINE_ADDR=127.0.0.1:8081 "$ROOT/risk-engine/bin/risk-engine" >> /tmp/helios-risk.log 2>&1
    echo "$(date) risk-engine exited ($?), restarting in 2s" >> "$KLOG"
    sleep 2
  done
) &

sleep 3  # let the engine bind before the agent's first tick

# 4) supervise the agent
(
  while true; do
    npm start >> /tmp/helios-agent.log 2>&1
    echo "$(date) agent exited ($?), restarting in 3s" >> "$KLOG"
    sleep 3
  done
) &

echo "$(date) keepalive up (caffeinate $CAFF)" >> "$KLOG"
wait
