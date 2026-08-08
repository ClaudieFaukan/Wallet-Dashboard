import type { IPriceProvider } from './price-provider.interface.js';

/** No-op — manual items are only updated via PUT /collectibles/:id/price, the sync cron skips them. */
export const manualProvider: IPriceProvider = {
  name: 'manual',
  async fetchPrice() {
    return null;
  },
};
