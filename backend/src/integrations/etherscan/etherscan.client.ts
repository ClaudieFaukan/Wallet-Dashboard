// Etherscan account balance API (V2 — the V1 endpoint used at scaffold time
// was deprecated and returns "NOTOK: deprecated V1 endpoint" as of 2026;
// V2 requires a chainid query param, 1 = Ethereum mainnet). Verified live
// against a real API key and a known public address.

const WEI_PER_ETH = 1_000_000_000_000_000_000n;
const ETHEREUM_MAINNET_CHAIN_ID = '1';

interface EtherscanBalanceResponse {
  status: string;
  message: string;
  result: string;
}

export async function getEthBalanceWei(address: string, apiKey: string): Promise<bigint> {
  const url = new URL('https://api.etherscan.io/v2/api');
  url.searchParams.set('chainid', ETHEREUM_MAINNET_CHAIN_ID);
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'balance');
  url.searchParams.set('address', address);
  url.searchParams.set('tag', 'latest');
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Etherscan request failed: ${response.status}`);
  }

  const data = (await response.json()) as EtherscanBalanceResponse;
  if (data.status !== '1') {
    throw new Error(`Etherscan error: ${data.message}`);
  }

  return BigInt(data.result);
}

export function weiToEth(wei: bigint): number {
  return Number(wei) / Number(WEI_PER_ETH);
}

interface CoinGeckoSimplePriceResponse {
  ethereum?: { usd: number };
}

/** ETH/USD spot price via CoinGecko's public (no-key) simple price endpoint. */
export async function getEthPriceUsd(): Promise<number> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
  );
  if (!response.ok) {
    throw new Error(`CoinGecko request failed: ${response.status}`);
  }

  const data = (await response.json()) as CoinGeckoSimplePriceResponse;
  if (!data.ethereum) throw new Error('CoinGecko returned no price for ethereum');

  return data.ethereum.usd;
}
