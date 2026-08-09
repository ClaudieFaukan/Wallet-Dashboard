const LAMPORTS_PER_SOL = 1_000_000_000;

interface SolanaRpcResponse {
  result?: { value: number };
  error?: { message: string };
}

/** Native SOL balance in lamports, via the public Solana JSON-RPC API (no key required). */
export async function getSolBalanceLamports(rpcUrl: string, address: string): Promise<number> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
  });
  if (!response.ok) {
    throw new Error(`Solana RPC request failed: ${response.status}`);
  }

  const data = (await response.json()) as SolanaRpcResponse;
  if (data.error) throw new Error(`Solana RPC error: ${data.error.message}`);
  if (!data.result) throw new Error('Solana RPC returned no result');

  return data.result.value;
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

const SPL_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

interface SplTokenAccountsRpcResponse {
  result?: {
    value: {
      account: {
        data: {
          parsed: {
            info: {
              mint: string;
              tokenAmount: { uiAmount: number | null; decimals: number };
            };
          };
        };
      };
    }[];
  };
  error?: { message: string };
}

export interface SplTokenBalance {
  mint: string;
  amount: number;
  decimals: number;
}

/** SPL token balances for a wallet, via `getTokenAccountsByOwner` with
 * `jsonParsed` encoding (public RPC, no key). Only mint + amount are
 * available this way — resolving symbol/name would need a separate token
 * registry lookup, not done here. */
export async function getSplTokenAccounts(rpcUrl: string, address: string): Promise<SplTokenBalance[]> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [address, { programId: SPL_TOKEN_PROGRAM_ID }, { encoding: 'jsonParsed' }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Solana RPC request failed: ${response.status}`);
  }

  const data = (await response.json()) as SplTokenAccountsRpcResponse;
  if (data.error) throw new Error(`Solana RPC error: ${data.error.message}`);

  return (data.result?.value ?? [])
    .map((v) => v.account.data.parsed.info)
    .filter((info) => (info.tokenAmount.uiAmount ?? 0) > 0)
    .map((info) => ({
      mint: info.mint,
      amount: info.tokenAmount.uiAmount!,
      decimals: info.tokenAmount.decimals,
    }));
}

interface CoinGeckoSimplePriceResponse {
  solana?: { usd: number };
}

/** SOL/USD spot price via CoinGecko's public (no-key) simple price endpoint. */
export async function getSolPriceUsd(): Promise<number> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
  );
  if (!response.ok) {
    throw new Error(`CoinGecko request failed: ${response.status}`);
  }

  const data = (await response.json()) as CoinGeckoSimplePriceResponse;
  if (!data.solana) throw new Error('CoinGecko returned no price for solana');

  return data.solana.usd;
}
