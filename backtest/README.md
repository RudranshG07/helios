# Backtest harness

Replays the Helios strategy on real BNB price history to validate **return vs drawdown** before the live week. Mirrors the live decide-engine (ensemble conviction + regime switch + volatility-targeted sizing) and the risk gate (drawdown breaker, exposure cap, simulated cost).

```bash
python3 backtest/backtest.py
```

- Data: free Binance klines (BNB/USDT hourly, no API key).
- No dependencies (stdlib only).

Output reports total return, **buy-and-hold comparison**, max drawdown, trade count, and win rate. The goal is to confirm the agent controls drawdown and meets trade-count turnover while beating passive holding — especially in down markets.

Note: this reimplements the strategy logic in Python for fast offline validation; the live path is the TypeScript core + Go risk engine. Tune `CFG` to match `config.json`.
