package main

import "fmt"

type book struct {
	value    map[string]float64
	exposure float64
	equity   float64
	stable   string
}

func Evaluate(req EvalRequest) EvalResponse {
	cfg := req.Config
	pf := req.Portfolio

	resp := EvalResponse{
		DrawdownPct: drawdownPct(pf),
		Approved:    []Trade{},
		Rejected:    []Rejection{},
		Notes:       []string{},
	}

	flatten := cfg.KillSwitch || resp.DrawdownPct >= cfg.HardDrawdownStopPct
	switch {
	case cfg.KillSwitch:
		resp.Verdict = VerdictKill
	case resp.DrawdownPct >= cfg.HardDrawdownStopPct:
		resp.Verdict = VerdictBreaker
	case resp.DrawdownPct >= cfg.DrawdownWarnPct:
		resp.Verdict = VerdictWarn
	default:
		resp.Verdict = VerdictOK
	}
	resp.Flatten = flatten

	if pf.TradeCount < cfg.MinTradesTarget {
		resp.Notes = append(resp.Notes, fmt.Sprintf("trade count %d below target %d", pf.TradeCount, cfg.MinTradesTarget))
	}

	b := newBook(pf, cfg.StableAsset)
	allowed := tokenSet(cfg.AllowedTokens)

	for _, t := range req.Plan.Trades {
		if reason := validate(t, req, flatten, allowed, b); reason != "" {
			resp.Rejected = append(resp.Rejected, Rejection{Trade: t, Reason: reason})
			continue
		}
		b.apply(t)
		resp.Approved = append(resp.Approved, t)
	}
	return resp
}

func validate(t Trade, req EvalRequest, flatten bool, allowed map[string]bool, b *book) string {
	cfg := req.Config

	if !allowed[t.Token] {
		return "token not in allowed list"
	}
	if t.SizeUsd <= 0 {
		return "non-positive size"
	}
	if t.MaxSlippageBps > cfg.MaxSlippageBps {
		return "slippage exceeds cap"
	}

	switch t.Side {
	case SideSell:
		if t.SizeUsd > b.value[t.Token]+1e-9 {
			return "sell exceeds current position"
		}
		return ""
	case SideBuy:
		if flatten {
			return "breaker active: entries blocked"
		}
		if t.SizeUsd > cfg.MaxTradeSizeUsd {
			return "size exceeds max trade size"
		}
		if t.LiquidityUsd < cfg.MinLiquidityUsd {
			return "liquidity below minimum"
		}
		if secondsSince(req.NowUnix, req.LastTrade[t.Token]) < int64(cfg.CooldownMinutes)*60 {
			return "cooldown active"
		}
		if b.equity <= 0 {
			return "no equity available"
		}
		if (b.value[t.Token]+t.SizeUsd)/b.equity > cfg.MaxPositionPctPerToken {
			return "per-token position cap exceeded"
		}
		if (b.exposure+t.SizeUsd)/b.equity > cfg.MaxExposurePct {
			return "total exposure cap exceeded"
		}
		return ""
	default:
		return "unknown side"
	}
}

func newBook(pf Portfolio, stable string) *book {
	b := &book{value: map[string]float64{}, equity: pf.EquityUsd, stable: stable}
	for _, p := range pf.Positions {
		v := p.QtyBase * p.MarkPxUsd
		b.value[p.Token] += v
		if p.Token != stable {
			b.exposure += v
		}
	}
	return b
}

func (b *book) apply(t Trade) {
	delta := t.SizeUsd
	if t.Side == SideSell {
		delta = -t.SizeUsd
	}
	b.value[t.Token] += delta
	if t.Token != b.stable {
		b.exposure += delta
	}
}

func drawdownPct(pf Portfolio) float64 {
	if pf.HighWaterUsd <= 0 {
		return 0
	}
	dd := (pf.HighWaterUsd - pf.EquityUsd) / pf.HighWaterUsd
	if dd < 0 {
		return 0
	}
	return dd
}

func secondsSince(now, then int64) int64 {
	if then <= 0 {
		return 1 << 62
	}
	return now - then
}

func tokenSet(tokens []string) map[string]bool {
	set := make(map[string]bool, len(tokens))
	for _, t := range tokens {
		set[t] = true
	}
	return set
}
