import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

export interface X402Result {
  ok: boolean;
  note: string;
  settled?: boolean;
  data?: unknown;
}

export async function paidCmcCall(): Promise<X402Result> {
  const url = process.env.X402_CMC_URL;
  const key = process.env.X402_PRIVATE_KEY ?? process.env.FALLBACK_PRIVATE_KEY;
  if (!url) return { ok: false, note: "x402 disabled (set X402_CMC_URL)" };
  if (!key) return { ok: false, note: "x402 disabled (no wallet key for Base USDC payment)" };

  try {
    const account = privateKeyToAccount(key as `0x${string}`);
    const fetchWithPayment = wrapFetchWithPayment(fetch, account);
    const res = await fetchWithPayment(url, { method: "GET" });
    const data = await res.json().catch(() => null);
    const header = res.headers.get("x-payment-response");
    const settlement = header ? decodeXPaymentResponse(header) : null;
    return { ok: true, settled: settlement !== null, note: `x402 paid CMC call ok (${res.status})`, data };
  } catch (err) {
    return { ok: false, note: `x402 call failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
