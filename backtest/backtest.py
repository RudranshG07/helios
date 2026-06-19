#!/usr/bin/env python3
"""Replay the Helios strategy on real BNB history to validate return vs drawdown.

Mirrors the live decide-engine logic (ensemble conviction + regime switch +
vol-target sizing) and the risk gate (drawdown breaker, exposure cap, cost).
Data: free Binance klines (no API key).
"""
import json
import math
import sys
import urllib.request

CFG = {
    "maxExposurePct": 0.80,
    "maxTradeFrac": 0.25,
    "hardDrawdownStopPct": 0.25,
    "perTradeCostBps": 30,
    "trendThreshold": 0.3,
    "rebalanceBandPct": 0.06,
    "startUsd": 1000.0,
}


def fetch(symbol="BNBUSDT", interval="1h", limit=1000):
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={interval}&limit={limit}"
    with urllib.request.urlopen(url, timeout=20) as r:
        return [float(k[4]) for k in json.load(r)]  # close prices


def ema(values, period):
    k = 2 / (period + 1)
    out = [values[0]]
    for v in values[1:]:
        out.append(v * k + out[-1] * (1 - k))
    return out


def rsi(values, period=14):
    out = [50.0] * len(values)
    gains = losses = 0.0
    for i in range(1, len(values)):
        ch = values[i] - values[i - 1]
        g = max(ch, 0.0)
        l = max(-ch, 0.0)
        if i <= period:
            gains += g
            losses += l
            if i == period:
                ag, al = gains / period, losses / period
                out[i] = 100 - 100 / (1 + (ag / al if al else 999))
        else:
            ag = (ag * (period - 1) + g) / period
            al = (al * (period - 1) + l) / period
            out[i] = 100 - 100 / (1 + (ag / al if al else 999))
    return out


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def conviction(trend, momentum, cross, regime):
    trending = abs(trend) >= CFG["trendThreshold"]
    s = (0.5 * trend + 0.3 * momentum + 0.2 * cross) if trending else (-0.6 * momentum + 0.2 * cross)
    if regime == "risk-on":
        s += 0.1
    if regime == "risk-off":
        s = min(s, 0)
    return clamp(s, -1, 1)


def run(prices):
    ema7, ema30 = ema(prices, 7), ema(prices, 30)
    rsi14 = rsi(prices, 14)
    cost = CFG["perTradeCostBps"] / 10000

    cash, qty = CFG["startUsd"], 0.0
    hw = CFG["startUsd"]
    max_dd = 0.0
    trades = 0
    wins = 0
    sells = 0
    entry = 0.0
    fast = slow = 0.0
    peak_equity = CFG["startUsd"]

    for i in range(30, len(prices)):
        px = prices[i]
        equity = cash + qty * px
        hw = max(hw, equity)
        peak_equity = max(peak_equity, equity)
        dd = (hw - equity) / hw if hw > 0 else 0
        max_dd = max(max_dd, dd)

        ret = abs(math.log(px / prices[i - 1])) if prices[i - 1] > 0 else 0
        fast = 0.2 * ret + 0.8 * (fast or ret)
        slow = 0.02 * ret + 0.98 * (slow or ret)
        vol_scale = clamp(slow / fast, 0.3, 1.5) if fast > 0 else 1.0

        trend = clamp((ema7[i] - ema30[i]) / ema30[i] * 25, -1, 1)
        momentum = clamp((rsi14[i] - 50) / 50, -1, 1)
        regime = "risk-on" if (ema7[i] > ema30[i] and rsi14[i] > 52) else ("risk-off" if (ema7[i] < ema30[i] and rsi14[i] < 48) else "neutral")

        if dd >= CFG["hardDrawdownStopPct"]:
            target = 0.0
        else:
            target = clamp(max(0, conviction(trend, momentum, 0.0, regime)) * CFG["maxExposurePct"] * vol_scale, 0, CFG["maxExposurePct"])

        desired = target * equity
        held = qty * px
        delta = desired - held
        if abs(delta) < CFG["rebalanceBandPct"] * equity:
            continue
        size = min(abs(delta), CFG["maxTradeFrac"] * equity)
        if size < equity * 0.01:
            continue

        if delta > 0:  # buy
            spend = size
            got = (spend * (1 - cost)) / px
            cash -= spend
            entry = px if qty == 0 else (entry * qty + px * got) / (qty + got)
            qty += got
            trades += 1
        else:  # sell
            sell_qty = size / px
            sell_qty = min(sell_qty, qty)
            cash += sell_qty * px * (1 - cost)
            sells += 1
            if px > entry:
                wins += 1
            qty -= sell_qty
            trades += 1

    final = cash + qty * prices[-1]
    bh = CFG["startUsd"] * (prices[-1] / prices[30])
    return {
        "bars": len(prices) - 30,
        "finalEquity": round(final, 2),
        "totalReturnPct": round((final / CFG["startUsd"] - 1) * 100, 2),
        "buyHoldReturnPct": round((bh / CFG["startUsd"] - 1) * 100, 2),
        "maxDrawdownPct": round(max_dd * 100, 2),
        "trades": trades,
        "winRatePct": round((wins / sells * 100) if sells else 0, 1),
    }


def main():
    try:
        prices = fetch()
    except Exception as e:  # noqa
        print(f"could not fetch price data: {e}")
        sys.exit(1)
    print(f"fetched {len(prices)} BNB/USDT hourly closes")
    print(json.dumps(run(prices), indent=2))


if __name__ == "__main__":
    main()
