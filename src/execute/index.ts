import type { Config, Trade } from "../types/index.ts";
import type { Fill } from "../state/store.ts";
import { tokenBySymbol } from "../universe.ts";
import { twakSwap } from "./twak.ts";

export interface Executor {
  execute(trade: Trade, price: number): Promise<Fill>;
}

export function createExecutor(cfg: Config): Executor {
  return cfg.mode === "paper" ? new PaperExecutor(cfg) : new TwakExecutor(cfg);
}

class TwakExecutor implements Executor {
  private readonly cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  async execute(trade: Trade): Promise<Fill> {
    const stable = this.cfg.risk.stableAsset;
    const fromSym = trade.side === "buy" ? stable : trade.token;
    const toSym = trade.side === "buy" ? trade.token : stable;
    const fromTok = tokenBySymbol(fromSym);
    const toTok = tokenBySymbol(toSym);
    const args = {
      sizeUsd: trade.sizeUsd,
      from: fromTok?.address ?? fromSym,
      to: toTok?.address ?? toSym,
      chain: this.cfg.chain.twakChain,
      slippagePct: trade.maxSlippageBps / 100,
      decimals: fromTok?.decimals,
      password: process.env.TWAK_WALLET_PASSWORD,
    };

    const quote = await twakSwap(args, true);
    const capPct = trade.maxSlippageBps / 100;
    if (Number.isFinite(quote.priceImpactPct) && quote.priceImpactPct > capPct) {
      throw new Error(`slippage guard: price impact ${quote.priceImpactPct}% exceeds cap ${capPct}% for ${fromSym}->${toSym}`);
    }

    const result = await twakSwap(args, false);

    if (trade.side === "buy") {
      return { txHash: result.txHash, token: trade.token, stableDelta: -result.inputAmount, tokenDelta: result.outputAmount, notionalUsd: result.inputAmount };
    }
    return { txHash: result.txHash, token: trade.token, stableDelta: result.outputAmount, tokenDelta: -result.inputAmount, notionalUsd: result.outputAmount };
  }
}

class PaperExecutor implements Executor {
  private readonly cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  async execute(trade: Trade, price: number): Promise<Fill> {
    const net = trade.sizeUsd * (1 - this.cfg.risk.perTradeCostBps / 10_000);
    if (trade.side === "buy") {
      return { txHash: `paper:${trade.clientOrderId}`, token: trade.token, stableDelta: -trade.sizeUsd, tokenDelta: net / price, notionalUsd: trade.sizeUsd };
    }
    return { txHash: `paper:${trade.clientOrderId}`, token: trade.token, stableDelta: net, tokenDelta: -(trade.sizeUsd / price), notionalUsd: net };
  }
}
