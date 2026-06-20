package main

const (
	VerdictOK      = "OK"
	VerdictWarn    = "WARN"
	VerdictBreaker = "BREAKER"
	VerdictKill    = "KILL"

	SideBuy  = "buy"
	SideSell = "sell"
)

type Position struct {
	Token      string  `json:"token"`
	QtyBase    float64 `json:"qtyBase"`
	EntryPxUsd float64 `json:"entryPxUsd"`
	MarkPxUsd  float64 `json:"markPxUsd"`
}

type Portfolio struct {
	EquityUsd    float64    `json:"equityUsd"`
	HighWaterUsd float64    `json:"highWaterUsd"`
	TradeCount   int        `json:"tradeCount"`
	Positions    []Position `json:"positions"`
}

type Trade struct {
	Token          string  `json:"token"`
	Side           string  `json:"side"`
	SizeUsd        float64 `json:"sizeUsd"`
	MaxSlippageBps int     `json:"maxSlippageBps"`
	LiquidityUsd   float64 `json:"liquidityUsd"`
	ClientOrderId  string  `json:"clientOrderId"`
}

type TradePlan struct {
	TargetExposurePct float64 `json:"targetExposurePct"`
	Trades            []Trade `json:"trades"`
}

type RiskConfig struct {
	MaxExposurePct         float64  `json:"maxExposurePct"`
	MaxPositionPctPerToken float64  `json:"maxPositionPctPerToken"`
	MaxTradeSizeUsd        float64  `json:"maxTradeSizeUsd"`
	HardDrawdownStopPct    float64  `json:"hardDrawdownStopPct"`
	DrawdownWarnPct        float64  `json:"drawdownWarnPct"`
	MinTradesTarget        int      `json:"minTradesTarget"`
	MinLiquidityUsd        float64  `json:"minLiquidityUsd"`
	MaxSlippageBps         int      `json:"maxSlippageBps"`
	PerTradeCostBps        int      `json:"perTradeCostBps"`
	MaxDailyNotionalUsd    float64  `json:"maxDailyNotionalUsd"`
	CooldownMinutes        int      `json:"cooldownMinutes"`
	AllowedTokens          []string `json:"allowedTokens"`
	StableAsset            string   `json:"stableAsset"`
	KillSwitch             bool     `json:"killSwitch"`
}

type EvalRequest struct {
	NowUnix          int64            `json:"nowUnix"`
	Portfolio        Portfolio        `json:"portfolio"`
	Plan             TradePlan        `json:"plan"`
	Config           RiskConfig       `json:"config"`
	LastTrade        map[string]int64 `json:"lastTrade"`
	DailyNotionalUsd float64          `json:"dailyNotionalUsd"`
}

type Rejection struct {
	Trade  Trade  `json:"trade"`
	Reason string `json:"reason"`
}

type EvalResponse struct {
	Verdict     string      `json:"verdict"`
	DrawdownPct float64     `json:"drawdownPct"`
	Flatten     bool        `json:"flatten"`
	Approved    []Trade     `json:"approved"`
	Rejected    []Rejection `json:"rejected"`
	Notes       []string    `json:"notes"`
}
