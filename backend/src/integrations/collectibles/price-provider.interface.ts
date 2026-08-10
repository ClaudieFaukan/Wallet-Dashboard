import type * as schema from '../../db/schema/index.js';

export type CollectibleItem = typeof schema.collectibleItems.$inferSelect;

export interface PriceResult {
  priceEurCents: number | null;
  priceUsdCents: number | null;
  /** Matches the `collectible_price_snapshot_source` DB enum. */
  source: 'tcgdex_cardmarket' | 'tcgdex_tcgplayer' | 'pokemonpricetracker' | 'poketrace' | 'manual';
  rawData: unknown;
}

export interface IPriceProvider {
  readonly name: string;
  /** `apiKey` is resolved by the caller from `app_settings` (see SettingsService) — providers that don't need one ignore it. */
  fetchPrice(item: CollectibleItem, apiKey?: string | null): Promise<PriceResult | null>;
}
