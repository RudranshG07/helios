import { twakSwap } from "./twak.ts";

const chain = process.env.PROBE_CHAIN ?? "smartchain";

const buy = await twakSwap({ sizeUsd: 10, from: "USDT", to: "WBNB", chain, slippagePct: 0.8 }, true);
console.log("BUY  USDT->WBNB:", JSON.stringify(buy));

const sell = await twakSwap({ sizeUsd: 10, from: "WBNB", to: "USDT", chain, slippagePct: 0.8 }, true);
console.log("SELL WBNB->USDT:", JSON.stringify(sell));
