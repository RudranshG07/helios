package main

import "testing"

func baseConfig() RiskConfig {
	return RiskConfig{
		MaxExposurePct:         0.80,
		MaxPositionPctPerToken: 0.25,
		MaxTradeSizeUsd:        250,
		HardDrawdownStopPct:    0.25,
		DrawdownWarnPct:        0.18,
		MinTradesTarget:        30,
		MinLiquidityUsd:        250000,
		MaxSlippageBps:         80,
		PerTradeCostBps:        30,
		CooldownMinutes:        15,
		AllowedTokens:          []string{"WBNB", "USDT", "CAKE"},
		StableAsset:            "USDT",
	}
}

func buy(token string, size float64) Trade {
	return Trade{Token: token, Side: SideBuy, SizeUsd: size, MaxSlippageBps: 50, LiquidityUsd: 1_000_000, ClientOrderId: token + "-buy"}
}

func req(pf Portfolio, plan TradePlan) EvalRequest {
	return EvalRequest{NowUnix: 1_000_000, Portfolio: pf, Plan: plan, Config: baseConfig(), LastTrade: map[string]int64{}}
}

func TestApprovesHealthyBuy(t *testing.T) {
	pf := Portfolio{EquityUsd: 1000, HighWaterUsd: 1000, TradeCount: 30}
	resp := Evaluate(req(pf, TradePlan{Trades: []Trade{buy("WBNB", 200)}}))
	if resp.Verdict != VerdictOK {
		t.Fatalf("want OK, got %s", resp.Verdict)
	}
	if len(resp.Approved) != 1 {
		t.Fatalf("want 1 approved, got %d (%v)", len(resp.Approved), resp.Rejected)
	}
}

func TestBreakerBlocksBuysAllowsSells(t *testing.T) {
	pf := Portfolio{
		EquityUsd:    700,
		HighWaterUsd: 1000,
		TradeCount:   30,
		Positions:    []Position{{Token: "WBNB", QtyBase: 1, MarkPxUsd: 300}},
	}
	plan := TradePlan{Trades: []Trade{
		buy("CAKE", 100),
		{Token: "WBNB", Side: SideSell, SizeUsd: 300, MaxSlippageBps: 50},
	}}
	resp := Evaluate(req(pf, plan))
	if resp.Verdict != VerdictBreaker || !resp.Flatten {
		t.Fatalf("want BREAKER+flatten, got %s flatten=%v", resp.Verdict, resp.Flatten)
	}
	if len(resp.Approved) != 1 || resp.Approved[0].Side != SideSell {
		t.Fatalf("breaker should approve only the sell, got %+v", resp.Approved)
	}
}

func TestKillSwitch(t *testing.T) {
	cfg := baseConfig()
	cfg.KillSwitch = true
	r := EvalRequest{NowUnix: 1, Config: cfg, Portfolio: Portfolio{EquityUsd: 1000, HighWaterUsd: 1000}, Plan: TradePlan{Trades: []Trade{buy("WBNB", 100)}}}
	resp := Evaluate(r)
	if resp.Verdict != VerdictKill || len(resp.Approved) != 0 {
		t.Fatalf("kill switch should block all entries, got %s approved=%d", resp.Verdict, len(resp.Approved))
	}
}

func TestRejectsOversizedTrade(t *testing.T) {
	pf := Portfolio{EquityUsd: 100000, HighWaterUsd: 100000, TradeCount: 30}
	resp := Evaluate(req(pf, TradePlan{Trades: []Trade{buy("WBNB", 251)}}))
	if len(resp.Approved) != 0 || resp.Rejected[0].Reason != "size exceeds max trade size" {
		t.Fatalf("want size rejection, got %+v / %+v", resp.Approved, resp.Rejected)
	}
}

func TestRejectsHighSlippage(t *testing.T) {
	pf := Portfolio{EquityUsd: 1000, HighWaterUsd: 1000, TradeCount: 30}
	tr := buy("WBNB", 100)
	tr.MaxSlippageBps = 81
	resp := Evaluate(req(pf, TradePlan{Trades: []Trade{tr}}))
	if resp.Rejected[0].Reason != "slippage exceeds cap" {
		t.Fatalf("want slippage rejection, got %+v", resp.Rejected)
	}
}

func TestRejectsLowLiquidity(t *testing.T) {
	pf := Portfolio{EquityUsd: 1000, HighWaterUsd: 1000, TradeCount: 30}
	tr := buy("WBNB", 100)
	tr.LiquidityUsd = 1000
	resp := Evaluate(req(pf, TradePlan{Trades: []Trade{tr}}))
	if resp.Rejected[0].Reason != "liquidity below minimum" {
		t.Fatalf("want liquidity rejection, got %+v", resp.Rejected)
	}
}

func TestEnforcesPerTokenCap(t *testing.T) {
	pf := Portfolio{
		EquityUsd:    1000,
		HighWaterUsd: 1000,
		TradeCount:   30,
		Positions:    []Position{{Token: "WBNB", QtyBase: 1, MarkPxUsd: 200}},
	}
	resp := Evaluate(req(pf, TradePlan{Trades: []Trade{buy("WBNB", 100)}}))
	if resp.Rejected[0].Reason != "per-token position cap exceeded" {
		t.Fatalf("want per-token cap rejection, got %+v", resp.Rejected)
	}
}

func TestEnforcesExposureCap(t *testing.T) {
	cfg := baseConfig()
	cfg.MaxPositionPctPerToken = 0.9
	pf := Portfolio{
		EquityUsd:    1000,
		HighWaterUsd: 1000,
		TradeCount:   30,
		Positions: []Position{
			{Token: "WBNB", QtyBase: 1, MarkPxUsd: 500},
			{Token: "CAKE", QtyBase: 1, MarkPxUsd: 290},
		},
	}
	r := EvalRequest{NowUnix: 1_000_000, Portfolio: pf, Config: cfg, LastTrade: map[string]int64{}, Plan: TradePlan{Trades: []Trade{buy("CAKE", 20)}}}
	resp := Evaluate(r)
	if len(resp.Approved) != 0 || resp.Rejected[0].Reason != "total exposure cap exceeded" {
		t.Fatalf("want exposure cap rejection, got approved=%+v rejected=%+v", resp.Approved, resp.Rejected)
	}
}

func TestCooldownBlocksRapidReentry(t *testing.T) {
	pf := Portfolio{EquityUsd: 1000, HighWaterUsd: 1000, TradeCount: 30}
	r := req(pf, TradePlan{Trades: []Trade{buy("WBNB", 100)}})
	r.LastTrade["WBNB"] = r.NowUnix - 60
	resp := Evaluate(r)
	if resp.Rejected[0].Reason != "cooldown active" {
		t.Fatalf("want cooldown rejection, got %+v", resp.Rejected)
	}
}

func TestRejectsDisallowedToken(t *testing.T) {
	pf := Portfolio{EquityUsd: 1000, HighWaterUsd: 1000, TradeCount: 30}
	resp := Evaluate(req(pf, TradePlan{Trades: []Trade{buy("DOGE", 100)}}))
	if resp.Rejected[0].Reason != "token not in allowed list" {
		t.Fatalf("want token rejection, got %+v", resp.Rejected)
	}
}

func TestWarnZoneStillTrades(t *testing.T) {
	pf := Portfolio{EquityUsd: 810, HighWaterUsd: 1000, TradeCount: 30}
	resp := Evaluate(req(pf, TradePlan{Trades: []Trade{buy("WBNB", 100)}}))
	if resp.Verdict != VerdictWarn || len(resp.Approved) != 1 {
		t.Fatalf("warn zone should still trade, got %s approved=%d", resp.Verdict, len(resp.Approved))
	}
}
