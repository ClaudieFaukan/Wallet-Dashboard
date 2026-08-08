import { env } from '../../config/env.js';
import type { CollectibleItem, IPriceProvider, PriceResult } from './price-provider.interface.js';

// PokemonPriceTracker API v2 (https://www.pokemonpricetracker.com/pokemon-card-api).
// Free tier: 100 credits/day. Never exercised live (no API key at scaffold
// time) — request/response shape below is a best-effort reading of the
// public docs (Bearer auth, prices.market in USD via TCGPlayer data,
// GET /api/v2/cards or /api/v2/sealed-products — the user's spec said
// "/sealed" but the current docs name it "/sealed-products"), unverified.

const API_BASE = 'https://www.pokemonpricetracker.com/api/v2';

interface PokemonPriceTrackerCard {
  name: string;
  prices?: { market?: number };
}

interface PokemonPriceTrackerSearchResponse {
  data?: PokemonPriceTrackerCard[];
}

async function search(
  endpoint: 'cards' | 'sealed-products',
  query: string,
  apiKey: string,
): Promise<PokemonPriceTrackerCard | null> {
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set('search', query);
  url.searchParams.set('limit', '1');

  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) {
    throw new Error(`PokemonPriceTracker request failed: ${response.status}`);
  }

  const data = (await response.json()) as PokemonPriceTrackerSearchResponse;
  return data.data?.[0] ?? null;
}

export const pokemonPriceTrackerProvider: IPriceProvider = {
  name: 'pokemonpricetracker',
  async fetchPrice(item: CollectibleItem): Promise<PriceResult | null> {
    if (!env.POKEMON_PRICE_TRACKER_API_KEY) return null;

    const endpoint = item.itemType === 'sealed' ? 'sealed-products' : 'cards';
    const card = await search(endpoint, item.name, env.POKEMON_PRICE_TRACKER_API_KEY);
    if (!card?.prices?.market) return null;

    return {
      priceEurCents: null,
      priceUsdCents: Math.round(card.prices.market * 100),
      source: 'pokemonpricetracker',
      rawData: card,
    };
  },
};
