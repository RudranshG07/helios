export interface TokenInfo {
  symbol: string;
  cmcId: number;
  address: string;
  decimals: number;
}

// Eligible (CMC-listed) BEP-20 tokens, liquid on PancakeSwap. Addresses = Binance-Peg on BSC mainnet.
export const UNIVERSE: TokenInfo[] = [
  { symbol: "ETH", cmcId: 1027, address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", decimals: 18 },
  { symbol: "CAKE", cmcId: 7186, address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18 },
  { symbol: "XRP", cmcId: 52, address: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE", decimals: 18 },
  { symbol: "LINK", cmcId: 1975, address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", decimals: 18 },
  { symbol: "UNI", cmcId: 7083, address: "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1", decimals: 18 },
];

export const STABLE: TokenInfo = { symbol: "USDT", cmcId: 825, address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 };

const BY_SYMBOL = new Map<string, TokenInfo>([...UNIVERSE, STABLE].map((t) => [t.symbol, t]));

export function tokenBySymbol(symbol: string): TokenInfo | undefined {
  return BY_SYMBOL.get(symbol);
}
