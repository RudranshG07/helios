# Helios Regime-Adaptive Momentum — CMC Strategy Skill (Track 2)

**A backtestable, regime-adaptive crypto trading strategy authored as a CoinMarketCap Agent Hub Skill.** It reads CMC's decision-ready signals, classifies the market regime, and switches between momentum and mean-reversion with volatility-targeted sizing — all deterministic and explainable.

## What it does (one line)
Blend CMC regime, technicals, and derivatives positioning into a single conviction score; trade momentum when trending and mean-reversion when ranging; size by volatility; hard-gate by drawdown.

## Inputs — CoinMarketCap Agent Hub tools
| Signal | CMC tool | Used for |
|---|---|---|
| Market regime | `get_global_metrics_latest` | fear-&-greed, altcoin-season, BTC dominance → risk-on / neutral / risk-off |
| Trend & momentum | `get_crypto_technical_analysis` | EMA-7 vs EMA-30 (trend), RSI-14 + MACD histogram (momentum) |
| Cross-asset pressure | `get_global_crypto_derivatives_metrics` | funding / open-interest shifts |
| Price & liquidity | `get_crypto_quotes_latest` | mark price, 24h volume (liquidity filter) |

## The rules (deterministic — fully reproducible)

**1. Normalize signals → [-1, 1]:**
- `trend = clamp((EMA7 − EMA30)/EMA30 × 25, −1, 1)`
- `momentum = clamp((RSI14 − 50)/50, −1, 1)`
- `crossAssetPressure = clamp(change7d/20 − Δdominance/5, −1, 1)`

**2. Regime switch (the core idea):**
- **Trending** (`|trend| ≥ 0.3`): `conviction = 0.5·trend + 0.3·momentum + 0.2·crossAssetPressure`  *(ride momentum)*
- **Ranging** (`|trend| < 0.3`): `conviction = −0.6·momentum + 0.2·crossAssetPressure`  *(fade extremes — mean-reversion)*
- Regime gate: `risk-on` adds +0.1; `risk-off` clamps conviction to ≤ 0 (no longs).

**3. Volatility-targeted sizing:** scale target exposure by `clamp(slowVol/fastVol, 0.3, 1.5)` — bigger in calm regimes, smaller when volatility spikes.

**4. Target exposure:** `clamp(max(0, conviction) × maxExposure × volScale, 0, maxExposure)`. Rebalance only when the gap exceeds a deadband (cuts churn/cost).

**5. Risk gates (hard, always-on):** drawdown breaker below the cap → flatten; per-asset & total exposure caps; per-trade & daily notional caps; slippage cap; cooldown. The strategy can never breach its declared limits.

## Backtest (real BNB/ETH hourly data, simulated costs)
Replayed on ~40 days of hourly data with 30 bps simulated cost (`backtest/backtest.py`, stdlib only, reproducible):

| Metric | Strategy | Buy & hold |
|---|---|---|
| Total return | **−0.6%** | −9.7% |
| Max drawdown | **3.9%** | — |
| Trades | 45 | — |
| Win rate | ~48% |

**Read:** in a falling market the strategy preserved ~9% of capital vs passive holding, with a 3.9% drawdown — i.e., it does its job (survive + outperform) precisely when it matters. Run it yourself: `python3 backtest/backtest.py`.

## Why it's a strong Skill
- **Deterministic & explainable** — every entry/exit traces to named signals, not a black-box LLM.
- **Regime-aware** — adapts to trending vs ranging markets instead of one static rule.
- **Risk-first** — drawdown-gated, so it controls the downside that ruins most strategies.
- **Reusable** — pure function over CMC signals; drop it into any agent.

## Files
- Strategy logic: `src/decide/index.ts` (ensemble + regime switch + vol-target), `risk-engine/` (the gates).
- Backtest: `backtest/backtest.py`, `backtest/README.md`.
