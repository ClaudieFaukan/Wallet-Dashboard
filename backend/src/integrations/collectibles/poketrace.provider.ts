import { env } from '../../config/env.js';
import type { CollectibleItem, IPriceProvider, PriceResult } from './price-provider.interface.js';

// Poketrace API (https://poketrace.com/docs). Never exercised live (no API
// key at scaffold time) — the public docs confirm the base URL, X-API-Key
// header, and `market=US|EU` / `product_type=sealed` query params, but not
// the exact response field names for price data, which weren't reachable
// through the docs site at scaffold time. Best-effort field guesses below
// (`price` / `market_price` / `value`), unverified — re-check against a real
// response before relying on this provider.

const API_BASE = 'https://api.poketrace.com/v1';

interface PoketraceCard {
  name?: string;
  price?: number;
  market_price?: number;
  value?: number;
}

interface PoketraceSearchResponse {
  data?: PoketraceCard[];
}

async function search(
  productType: 'card' | 'sealed',
  query: string,
  apiKey: string,
): Promise<PoketraceCard | null> {
  const url = new URL(`${API_BASE}/cards`);
  url.searchParams.set('search', query);
  url.searchParams.set('market', 'EU');
  if (productType === 'sealed') url.searchParams.set('product_type', 'sealed');

  const response = await fetch(url, { headers: { 'X-API-Key': apiKey } });
  if (!response.ok) {
    throw new Error(`Poketrace request failed: ${response.status}`);
  }

  const data = (await response.json()) as PoketraceSearchResponse;
  return data.data?.[0] ?? null;
}

export const poketraceProvider: IPriceProvider = {
  name: 'poketrace',
  async fetchPrice(item: CollectibleItem): Promise<PriceResult | null> {
    if (!env.POKETRACE_API_KEY) return null;

    const productType = item.itemType === 'sealed' ? 'sealed' : 'card';
    const card = await search(productType, item.name, env.POKETRACE_API_KEY);
    const priceEur = card?.price ?? card?.market_price ?? card?.value ?? null;
    if (priceEur === null) return null;

    return {
      priceEurCents: Math.round(priceEur * 100),
      priceUsdCents: null,
      source: 'poketrace',
      rawData: card,
    };
  },
};
