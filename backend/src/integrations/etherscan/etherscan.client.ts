// Etherscan account balance API (V2 — the V1 endpoint used at scaffold time
// was deprecated and returns "NOTOK: deprecated V1 endpoint" as of 2026;
// V2 requires a chainid query param). Verified live against a real API key
// and a known public address.
//
// Etherscan V2 is a unified multi-chain API — the same key works across EVM chains just by
// changing chainid, which is why every function here takes one instead of hardcoding Ethereum
// mainnet. Added to cover BNB Chain (a real MetaMask wallet's assets are commonly split across
// both, verified against the user's own wallet — Ethereum mainnet alone undercounted the total
// shown in the real MetaMask app).

const WEI_PER_ETH = 1_000_000_000_000_000_000n;
export const ETHEREUM_MAINNET_CHAIN_ID = '1';
export const BNB_CHAIN_ID = '56';

/** Thrown when Etherscan rejects a chain outright because the caller's plan doesn't cover it —
 * verified live: a free-tier key gets `{status:'0', result:"Free API access is not supported for
 * this chain. Please upgrade your api plan..."}` for chainid=56 (BNB Chain), on every single
 * call, permanently (not a transient rate limit). Callers should treat this as "this chain isn't
 * available right now" rather than a real failure worth alarming the user about. */
export class EtherscanUnsupportedChainError extends Error {}

function isUnsupportedChainMessage(message: string): boolean {
  return message.toLowerCase().includes('not supported for this chain');
}

interface EtherscanBalanceResponse {
  status: string;
  message: string;
  result: string;
}

export async function getEthBalanceWei(
  address: string,
  apiKey: string,
  chainId: string = ETHEREUM_MAINNET_CHAIN_ID,
): Promise<bigint> {
  const url = new URL('https://api.etherscan.io/v2/api');
  url.searchParams.set('chainid', chainId);
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
    if (isUnsupportedChainMessage(data.result)) {
      throw new EtherscanUnsupportedChainError(data.result);
    }
    throw new Error(`Etherscan error: ${data.message}`);
  }

  return BigInt(data.result);
}

export function weiToEth(wei: bigint): number {
  return Number(wei) / Number(WEI_PER_ETH);
}

interface EtherscanTokenTransfer {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
}

interface EtherscanTokenTxResponse {
  status: string;
  message: string;
  result: EtherscanTokenTransfer[] | string;
}

export interface Erc20ContractInfo {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: number;
}

/** ERC-20 contracts a wallet has ever received/sent, derived from its transfer
 * history (`action=tokentx`) — Etherscan's free tier has no "list all token
 * balances" endpoint, so this is the standard workaround: discover contracts
 * from transfers, then query each one's current balance separately. */
export async function getErc20ContractsTouched(
  address: string,
  apiKey: string,
  chainId: string = ETHEREUM_MAINNET_CHAIN_ID,
): Promise<Erc20ContractInfo[]> {
  const url = new URL('https://api.etherscan.io/v2/api');
  url.searchParams.set('chainid', chainId);
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'tokentx');
  url.searchParams.set('address', address);
  url.searchParams.set('sort', 'desc');
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Etherscan request failed: ${response.status}`);
  }

  const data = (await response.json()) as EtherscanTokenTxResponse;
  if (data.status !== '1' || typeof data.result === 'string') {
    // "No transactions found" comes back as status "0" — not an error, just empty.
    if (data.message === 'No transactions found') return [];
    if (typeof data.result === 'string' && isUnsupportedChainMessage(data.result)) {
      throw new EtherscanUnsupportedChainError(data.result);
    }
    throw new Error(`Etherscan error: ${data.message}`);
  }

  const byContract = new Map<string, Erc20ContractInfo>();
  for (const tx of data.result) {
    const key = tx.contractAddress.toLowerCase();
    if (!byContract.has(key)) {
      byContract.set(key, {
        contractAddress: tx.contractAddress,
        tokenName: tx.tokenName,
        tokenSymbol: tx.tokenSymbol,
        tokenDecimal: Number(tx.tokenDecimal),
      });
    }
  }
  return Array.from(byContract.values());
}

interface EtherscanTokenBalanceResponse {
  status: string;
  message: string;
  result: string;
}

export async function getErc20Balance(
  address: string,
  contractAddress: string,
  apiKey: string,
  chainId: string = ETHEREUM_MAINNET_CHAIN_ID,
): Promise<bigint> {
  const url = new URL('https://api.etherscan.io/v2/api');
  url.searchParams.set('chainid', chainId);
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'tokenbalance');
  url.searchParams.set('contractaddress', contractAddress);
  url.searchParams.set('address', address);
  url.searchParams.set('tag', 'latest');
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Etherscan request failed: ${response.status}`);
  }

  const data = (await response.json()) as EtherscanTokenBalanceResponse;
  if (data.status !== '1') {
    throw new Error(`Etherscan error: ${data.message}`);
  }

  return BigInt(data.result);
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
