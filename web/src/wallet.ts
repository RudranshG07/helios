interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

const WC_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ?? "";

function injected(): Eip1193 | undefined {
  return (window as unknown as { ethereum?: Eip1193 }).ethereum;
}

export function hasWallet(): boolean {
  return injected() !== undefined || WC_PROJECT_ID.length > 0;
}

export async function connectWallet(): Promise<string | null> {
  const eth = injected();
  if (eth) {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    return accounts?.[0] ?? null;
  }
  if (WC_PROJECT_ID) {
    const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
    const provider = await EthereumProvider.init({
      projectId: WC_PROJECT_ID,
      chains: [56],
      showQrModal: true,
      metadata: { name: "Helios", description: "Autonomous self-custody trading agent", url: location.origin, icons: [] },
    });
    await provider.connect();
    return provider.accounts?.[0] ?? null;
  }
  return null;
}
