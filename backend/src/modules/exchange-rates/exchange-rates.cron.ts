import cron from 'node-cron';
import { exchangeRatesService } from './exchange-rates.routes.js';

/** Daily proactive refresh — `getLatest()` also self-heals on demand, this just keeps the cache warm. */
export function scheduleExchangeRatesSync(): void {
  cron.schedule('0 4 * * *', async () => {
    try {
      await exchangeRatesService.refresh();
      console.log('exchange-rates sync: refreshed');
    } catch (err) {
      console.error('exchange-rates sync cron failed:', err);
    }
  });
}
