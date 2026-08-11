export interface TokenPrice {
  usd: number | null;
  usd24hChange: number | null;
}

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  logoUrl: string;
  priceUsd: number;
  change24hPct: number | null;
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

interface CoinGeckoListEntry {
  id: string;
  symbol: string;
  name: string;
}

// CoinGecko's full ~15k-coin list, fetched once and cached in memory (not per-user data,
// safe to share process-wide) — the alternative (one /search call per unresolved symbol)
// would be far more requests against the free-tier rate limit for no real benefit, since
// this app only ever looks up a handful of common tickers held in personal wallets.
let coinsListCache: { fetchedAt: number; bySymbol: Map<string, string> } | null = null;
const COINS_LIST_TTL_MS = 24 * 60 * 60 * 1000;

async function getSymbolToIdMap(): Promise<Map<string, string>> {
  if (coinsListCache && Date.now() - coinsListCache.fetchedAt < COINS_LIST_TTL_MS) {
    return coinsListCache.bySymbol;
  }

  const response = await fetch('https://api.coingecko.com/api/v3/coins/list');
  if (!response.ok) {
    throw new Error(`CoinGecko coins list request failed: ${response.status}`);
  }
  const list = (await response.json()) as CoinGeckoListEntry[];

  // Ambiguous symbols (many coins reuse the same ticker) resolve to whichever entry comes
  // first in CoinGecko's list, which is not guaranteed to be the "main" one — acceptable
  // for a personal-use app tracking common majors, not a general-purpose resolver.
  const bySymbol = new Map<string, string>();
  for (const coin of list) {
    const key = coin.symbol.toLowerCase();
    if (!bySymbol.has(key)) bySymbol.set(key, coin.id);
  }

  coinsListCache = { fetchedAt: Date.now(), bySymbol };
  return bySymbol;
}

/** Resolves ticker symbols (e.g. "BTC", "eth") to CoinGecko coin ids. Symbols with no match
 * are simply absent from the returned map. */
export async function resolveSymbolsToIds(symbols: string[]): Promise<Map<string, string>> {
  const bySymbol = await getSymbolToIdMap();
  const result = new Map<string, string>();
  for (const symbol of symbols) {
    const id = bySymbol.get(symbol.toLowerCase());
    if (id) result.set(symbol, id);
  }
  return result;
}

interface CoinGeckoMarketEntry {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
}

/** Batched name/logo/current price/24h change for a list of CoinGecko coin ids. */
export async function getMarketData(ids: string[]): Promise<Map<string, CoinMarketData>> {
  const result = new Map<string, CoinMarketData>();
  if (ids.length === 0) return result;

  const url = new URL('https://api.coingecko.com/api/v3/coins/markets');
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('ids', ids.join(','));
  url.searchParams.set('price_change_percentage', '24h');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CoinGecko markets request failed: ${response.status}`);
  }

  const data = (await response.json()) as CoinGeckoMarketEntry[];
  for (const coin of data) {
    result.set(coin.id, {
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      logoUrl: coin.image,
      priceUsd: coin.current_price,
      change24hPct: coin.price_change_percentage_24h ?? null,
    });
  }
  return result;
}

/** Convenience wrapper: resolves a batch of ticker symbols straight to their market data,
 * keyed by the original (uppercased) symbol so callers can look up by ticker directly. */
export async function getMarketDataBySymbol(symbols: string[]): Promise<Map<string, CoinMarketData>> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const ids = await resolveSymbolsToIds(unique);
  if (ids.size === 0) return new Map();

  const marketData = await getMarketData([...ids.values()]);
  const result = new Map<string, CoinMarketData>();
  for (const symbol of unique) {
    const id = ids.get(symbol);
    const data = id ? marketData.get(id) : undefined;
    if (data) result.set(symbol, data);
  }
  return result;
}
