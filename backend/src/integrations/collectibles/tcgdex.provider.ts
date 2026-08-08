import TCGdex, { Query } from '@tcgdex/sdk';
import type { CollectibleItem, IPriceProvider, PriceResult } from './price-provider.interface.js';

const sdk = new TCGdex('fr');

// The @tcgdex/sdk published types don't declare the `pricing` field on Card,
// but the live API does return it (verified manually against
// https://api.tcgdex.net/v2/fr/cards/:id) — a known gap between the SDK's
// types and the actual API response. We type it ourselves and read it off
// the SDK's result at runtime.
interface TcgdexPricing {
  cardmarket?: { trend?: number; avg?: number };
  tcgplayer?: { normal?: { marketPrice?: number } };
}

export async function fetchTcgdexCardPrice(tcgdexId: string): Promise<PriceResult | null> {
  const card = await sdk.card.get(tcgdexId);
  if (!card) return null;

  const pricing = (card as unknown as { pricing?: TcgdexPricing }).pricing;
  if (!pricing) return null;

  const priceEur = pricing.cardmarket?.trend ?? pricing.cardmarket?.avg ?? null;
  const priceUsd = pricing.tcgplayer?.normal?.marketPrice ?? null;
  if (priceEur === null && priceUsd === null) return null;

  return {
    priceEurCents: priceEur !== null ? Math.round(priceEur * 100) : null,
    priceUsdCents: priceUsd !== null ? Math.round(priceUsd * 100) : null,
    source: priceEur !== null ? 'tcgdex_cardmarket' : 'tcgdex_tcgplayer',
    rawData: pricing,
  };
}

export interface CardSearchResult {
  tcgdexId: string;
  name: string;
  // TCGdex's card-list/search endpoint returns brief results with no set
  // info attached — only the detail endpoint (fetchTcgdexCardPrice) has it.
  setName: string | null;
  cardNumber: string | null;
  imageUrl: string | null;
}

export async function searchTcgdexCards(query: string): Promise<CardSearchResult[]> {
  const results = await sdk.card.list(Query.create().equal('name', query));
  return results.map((card) => ({
    tcgdexId: card.id,
    name: card.name,
    setName: null,
    cardNumber: card.localId,
    imageUrl: card.image ? `${card.image}/high.webp` : null,
  }));
}

export const tcgdexProvider: IPriceProvider = {
  name: 'tcgdex',
  async fetchPrice(item: CollectibleItem) {
    if (!item.tcgdexId) return null;
    return fetchTcgdexCardPrice(item.tcgdexId);
  },
};
