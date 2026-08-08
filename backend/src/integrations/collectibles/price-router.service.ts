import type { CollectiblePriceSource } from '../../db/schema/index.js';
import { manualProvider } from './manual.provider.js';
import { poketraceProvider } from './poketrace.provider.js';
import { pokemonPriceTrackerProvider } from './pokemonpricetracker.provider.js';
import type { IPriceProvider } from './price-provider.interface.js';
import { tcgdexProvider } from './tcgdex.provider.js';

const PROVIDERS: Record<CollectiblePriceSource, IPriceProvider> = {
  tcgdex: tcgdexProvider,
  manual: manualProvider,
  pokemonpricetracker: pokemonPriceTrackerProvider,
  poketrace: poketraceProvider,
};

/** Providers gated on a missing API key return `null` from `fetchPrice`, so callers just get "no price" rather than needing a separate availability check. */
export function getPriceProvider(priceSource: CollectiblePriceSource): IPriceProvider {
  return PROVIDERS[priceSource];
}
