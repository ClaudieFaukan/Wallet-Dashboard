export interface TokenPrice {
  usd: number | null;
  usd24hChange: number | null;
}

interface CoinGeckoTokenPriceResponse {
  [contractAddress: string]: { usd?: number; usd_24h_change?: number };
}

/** Batched USD price + 24h change for a list of token contract addresses, via
 * CoinGecko's public (no-key) token_price endpoint — one request for every
 * token on a wallet instead of one per token. Returns a map keyed by
 * lowercased contract address; missing entries mean CoinGecko has no listing
 * for that token (unknown/illiquid tokens are common on personal wallets). */
export async function getTokenPricesUsd(
  platform: 'ethereum' | 'solana',
  contractAddresses: string[],
): Promise<Record<string, TokenPrice>> {
  if (contractAddresses.length === 0) return {};

  const url = new URL(`https://api.coingecko.com/api/v3/simple/token_price/${platform}`);
  url.searchParams.set('contract_addresses', contractAddresses.join(','));
  url.searchParams.set('vs_currencies', 'usd');
  url.searchParams.set('include_24hr_change', 'true');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CoinGecko request failed: ${response.status}`);
  }

  const data = (await response.json()) as CoinGeckoTokenPriceResponse;
  const result: Record<string, TokenPrice> = {};
  for (const [address, price] of Object.entries(data)) {
    result[address.toLowerCase()] = {
      usd: price.usd ?? null,
      usd24hChange: price.usd_24h_change ?? null,
    };
  }
  return result;
}
