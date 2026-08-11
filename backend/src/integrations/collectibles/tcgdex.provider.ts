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
  setName: string | null;
  cardNumber: string | null;
  imageUrl: string | null;
}

export async function searchTcgdexCards(query: string): Promise<CardSearchResult[]> {
  // `equal` requires an exact, case-sensitive match on the card name (e.g. "pikachu"
  // returns nothing, only "Pikachu" does) — `like` does a case-insensitive partial
  // match, which is what a user typing a search term expects.
  console.log(`[tcgdex] searchCard query="${query}"`);

  // TCGdex's card-list/search endpoint returns brief results (id/localId/name/image
  // only) with no set info attached — only the detail endpoint has it. Rather than
  // fetching every result's detail (one request per card), we recover the set from
  // the id itself: card ids are always formatted as `${setId}-${localId}`, so we can
  // strip the trailing `-${localId}` and resolve the name against the full sets list
  // (~200 sets, fetched once and cached internally by the SDK).
  const [results, sets] = await Promise.all([
    sdk.card.list(Query.create().like('name', query)),
    sdk.set.list(),
  ]);
  const setNameById = new Map(sets.map((set) => [set.id, set.name]));

  console.log(`[tcgdex] searchCard query="${query}" -> ${results.length} result(s)`);
  return results.map((card) => {
    const setId = card.id.slice(0, card.id.lastIndexOf('-'));
    return {
      tcgdexId: card.id,
      name: card.name,
      setName: setNameById.get(setId) ?? null,
      cardNumber: card.localId,
      imageUrl: card.image ? `${card.image}/high.webp` : null,
    };
  });
}

export const tcgdexProvider: IPriceProvider = {
  name: 'tcgdex',
  async fetchPrice(item: CollectibleItem) {
    if (!item.tcgdexId) return null;
    return fetchTcgdexCardPrice(item.tcgdexId);
  },
};
