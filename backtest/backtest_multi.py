#!/usr/bin/env python3
"""Validate multi-asset rotation vs single-asset, on real eligible-token history.

Rotates into the strongest eligible token each bar (momentum + trend), vol-targeted,
drawdown-gated. Compares against single-ETH strategy and buy-and-hold. Free Binance
klines, stdlib only. Decides whether the live agent upgrade is worth it.
"""
import json
import math
import urllib.request

UNIVERSE = ["ETHUSDT", "CAKEUSDT", "XRPUSDT", "LINKUSDT", "UNIUSDT"]
COST_BPS = 30
START = 1000.0
TREND_THRESHOLD = 0.3


def fetch(symbol, interval="1h", limit=1000):
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={interval}&limit={limit}"
    with urllib.request.urlopen(url, timeout=20) as r:
        return [float(k[4]) for k in json.load(r)]


def ema(v, p):
    k = 2 / (p + 1)
    o = [v[0]]
    for x in v[1:]:
        o.append(x * k + o[-1] * (1 - k))
    return o


def rsi(v, p=14):
    out = [50.0] * len(v)
    ag = al = 0.0
    for i in range(1, len(v)):
        ch = v[i] - v[i - 1]
        g, l = max(ch, 0.0), max(-ch, 0.0)
        if i <= p:
            ag += g; al += l
            if i == p:
                ag, al = ag / p, al / p
                out[i] = 100 - 100 / (1 + (ag / al if al else 999))
        else:
            ag = (ag * (p - 1) + g) / p
            al = (al * (p - 1) + l) / p
            out[i] = 100 - 100 / (1 + (ag / al if al else 999))
    return out


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def conviction(ema7, ema30, rsi14, i):
    trend = clamp((ema7[i] - ema30[i]) / ema30[i] * 25, -1, 1)
    mom = clamp((rsi14[i] - 50) / 50, -1, 1)
    trending = abs(trend) >= TREND_THRESHOLD
    s = (0.5 * trend + 0.3 * mom) if trending else (-0.6 * mom)
    return clamp(s, -1, 1)


def run(series, exposure, stop, min_conv):
    n = min(len(s) for s in series.values())
    syms = list(series.keys())
    ind = {s: (ema(series[s][-n:], 7), ema(series[s][-n:], 30), rsi(series[s][-n:], 14)) for s in syms}
    px = {s: series[s][-n:] for s in syms}
    cost = COST_BPS / 10000

    cash, holding, qty, hw, max_dd, trades = START, None, 0.0, START, 0.0, 0
    for i in range(30, n):
        equity = cash + (qty * px[holding][i] if holding else 0)
        hw = max(hw, equity)
        dd = (hw - equity) / hw if hw > 0 else 0
        max_dd = max(max_dd, dd)

        bestc, best = max((conviction(*ind[s], i), s) for s in syms)
        target = best if (bestc >= min_conv and dd < stop) else None

        if holding and holding != target:
            cash += qty * px[holding][i] * (1 - cost); qty = 0.0; holding = None; trades += 1
        if target and holding != target:
            spend = min(exposure * equity, cash)
            if spend > equity * 0.02:
                qty = (spend * (1 - cost)) / px[target][i]; cash -= spend; holding = target; trades += 1

    final = cash + (qty * px[holding][-1] if holding else 0)
    return {"ret%": round((final / START - 1) * 100, 2), "maxDD%": round(max_dd * 100, 2), "trades": trades}


def main():
    series = {}
    for s in UNIVERSE:
        try:
            series[s] = fetch(s); print(f"  fetched {s}: {len(series[s])} bars")
        except Exception as e:  # noqa
            print(f"  skip {s}: {e}")
    if len(series) < 2:
        print("not enough data"); return
    n = min(len(s) for s in series.values())
    bh = {s: round((series[s][-1] / series[s][-(n - 30)] - 1) * 100, 1) for s in series}
    print("buy&hold each:", bh, "| avg", round(sum(bh.values()) / len(bh), 1))
    print("\nparameter sweep (exposure / stop / minConviction → return, maxDD, trades):")
    for exp in (0.4, 0.6, 0.8):
        for stop in (0.1, 0.15):
            for mc in (0.2, 0.4, 0.6):
                r = run(series, exp, stop, mc)
                print(f"  exp={exp} stop={stop} minConv={mc} -> ret {r['ret%']:>6}%  maxDD {r['maxDD%']:>5}%  trades {r['trades']}")


if __name__ == "__main__":
    main()
