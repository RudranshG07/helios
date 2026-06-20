import { loadConfig } from "../config/index.ts";
import { CmcSensor } from "./index.ts";
import { rankByConviction } from "../decide/index.ts";

const cfg = loadConfig();
const states = await new CmcSensor(cfg).read();
const ranked = rankByConviction(states, cfg.risk);
console.log(
  JSON.stringify(
    ranked.map((s) => ({ token: s.token, regime: s.regime, price: s.price, momentum: s.technicals.momentum, trend: s.technicals.trend })),
    null,
    2,
  ),
);
