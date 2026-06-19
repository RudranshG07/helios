interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function injected(): Eip1193 | undefined {
  return (window as unknown as { ethereum?: Eip1193 }).ethereum;
}

export function hasWallet(): boolean {
  return injected() !== undefined;
}

export async function connectInjected(): Promise<string | null> {
  const eth = injected();
  if (!eth) return null;
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  return accounts?.[0] ?? null;
}
