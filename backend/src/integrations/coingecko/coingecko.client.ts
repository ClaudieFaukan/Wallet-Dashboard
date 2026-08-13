export interface TokenPrice {
  usd: number | null;
  usd24hChange: number | null;
}

/** Attaches a user-supplied CoinGecko API key to a request, if one is configured — the free
 * "Demo" key (unlike a fully anonymous request) gets a meaningfully higher rate limit, which is
 * the whole point of letting the user set one in Settings. Requests without a key still work,
 * just against the anonymous (much tighter) limit. */
function withApiKeyHeaders(apiKey?: string): Record<string, string> | undefined {
  return apiKey ? { 'x-cg-demo-api-key': apiKey } : undefined;
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

/** USD price + 24h change for a list of token contract addresses, via CoinGecko's public
 * (no-key) token_price endpoint. One request per address, run sequentially — CoinGecko's free
 * tier used to accept a comma-joined batch here, but now rejects (400) any request listing
 * more than one contract address, so a wallet holding 2+ tokens would otherwise fail entirely.
 * Sequential (not parallel) because the free tier's overall rate limit is easily blown through
 * by firing one request per token at once on a wallet with a dozen+ tokens (verified live: 13
 * parallel requests triggered a 429). Returns a map keyed by lowercased contract address; an
 * address is absent from the map if CoinGecko has no listing for it (common for unknown/illiquid
 * tokens) or if that one lookup failed — either way the caller treats it the same (no price for
 * that token), rather than letting one bad/rate-limited address take down every other token's
 * price. */
export async function getTokenPricesUsd(
  platform: 'ethereum' | 'solana',
  contractAddresses: string[],
  apiKey?: string,
): Promise<Record<string, TokenPrice>> {
  const result: Record<string, TokenPrice> = {};

  for (const address of contractAddresses) {
    const url = new URL(`https://api.coingecko.com/api/v3/simple/token_price/${platform}`);
    url.searchParams.set('contract_addresses', address);
    url.searchParams.set('vs_currencies', 'usd');
    url.searchParams.set('include_24hr_change', 'true');

    try {
      const response = await fetch(url, { headers: withApiKeyHeaders(apiKey) });
      if (!response.ok) continue;

      const data = (await response.json()) as CoinGeckoTokenPriceResponse;
      // Only one address was requested, so take whichever single entry comes back rather
      // than relying on the response key matching our casing exactly.
      const price = Object.values(data)[0];
      if (price) {
        result[address.toLowerCase()] = { usd: price.usd ?? null, usd24hChange: price.usd_24h_change ?? null };
      }
    } catch {
      // Treated the same as "CoinGecko has no listing for this token" — see doc comment above.
    }
  }

  return result;
}

interface CoinGeckoContractResponse {
  symbol: string;
  name: string;
  image?: { small?: string };
  market_data?: {
    current_price?: { usd?: number };
    price_change_percentage_24h?: number | null;
  };
}

/** Full coin identity (name/symbol/logo) + price for a list of token contract/mint addresses,
 * resolved directly by address rather than by ticker. Needed for platforms (Solana SPL tokens)
 * where the caller has no name at all to begin with — only a mint address — so ticker-based
 * lookup (getMarketDataBySymbol) never had anything real to match against and always failed
 * silently, leaving tokens displayed as their raw truncated mint address (verified live: a
 * wallet's USDT and Phantom Staked SOL holdings showed as "Es9v…wNYB"/"pSo1…RQfL" instead of
 * their real names). One request per address, sequential — same rate-limit reasoning as
 * getTokenPricesUsd. Absent from the result if CoinGecko has no listing for that address or the
 * lookup failed. */
export async function getCoinsByContractAddress(
  platform: 'ethereum' | 'solana',
  contractAddresses: string[],
  apiKey?: string,
): Promise<Record<string, CoinMarketData>> {
  const result: Record<string, CoinMarketData> = {};

  for (const address of contractAddresses) {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${platform}/contract/${address}`,
        { headers: withApiKeyHeaders(apiKey) },
      );
      if (!response.ok) continue;

      const data = (await response.json()) as CoinGeckoContractResponse;
      const priceUsd = data.market_data?.current_price?.usd;
      if (priceUsd == null) continue;

      result[address.toLowerCase()] = {
        id: address,
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        logoUrl: data.image?.small ?? '',
        priceUsd,
        change24hPct: data.market_data?.price_change_percentage_24h ?? null,
      };
    } catch {
      // Treated the same as "CoinGecko has no listing for this contract" — see doc comment above.
    }
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

async function getSymbolToIdMap(apiKey?: string): Promise<Map<string, string>> {
  if (coinsListCache && Date.now() - coinsListCache.fetchedAt < COINS_LIST_TTL_MS) {
    return coinsListCache.bySymbol;
  }

  const response = await fetch('https://api.coingecko.com/api/v3/coins/list', {
    headers: withApiKeyHeaders(apiKey),
  });
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

// A few major tickers collide with obscure wrapped/bridged coins that also claim the same
// symbol on CoinGecko — verified live: native SOL was resolving to "Allbridge Bridged SOL (Near
// Protocol)" instead of real Solana, because that listing happens to sort earlier in CoinGecko's
// /coins/list than the genuine one. There's only one real Bitcoin/Ethereum/Solana, so these are
// resolved directly rather than trusting whichever entry the list-order pick lands on.
const KNOWN_SYMBOL_OVERRIDES: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
};

/** Resolves ticker symbols (e.g. "BTC", "eth") to CoinGecko coin ids. Symbols with no match
 * are simply absent from the returned map. */
export async function resolveSymbolsToIds(
  symbols: string[],
  apiKey?: string,
): Promise<Map<string, string>> {
  const bySymbol = await getSymbolToIdMap(apiKey);
  const result = new Map<string, string>();
  for (const symbol of symbols) {
    const override = KNOWN_SYMBOL_OVERRIDES[symbol.toUpperCase()];
    if (override) {
      result.set(symbol, override);
      continue;
    }
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
export async function getMarketData(
  ids: string[],
  apiKey?: string,
): Promise<Map<string, CoinMarketData>> {
  const result = new Map<string, CoinMarketData>();
  if (ids.length === 0) return result;

  const url = new URL('https://api.coingecko.com/api/v3/coins/markets');
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('ids', ids.join(','));
  url.searchParams.set('price_change_percentage', '24h');

  const response = await fetch(url, { headers: withApiKeyHeaders(apiKey) });
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
export async function getMarketDataBySymbol(
  symbols: string[],
  apiKey?: string,
): Promise<Map<string, CoinMarketData>> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const ids = await resolveSymbolsToIds(unique, apiKey);
  if (ids.size === 0) return new Map();

  const marketData = await getMarketData([...ids.values()], apiKey);
  const result = new Map<string, CoinMarketData>();
  for (const symbol of unique) {
    const id = ids.get(symbol);
    const data = id ? marketData.get(id) : undefined;
    if (data) result.set(symbol, data);
  }
  return result;
}
