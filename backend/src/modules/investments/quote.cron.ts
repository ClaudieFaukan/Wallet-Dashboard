import cron from 'node-cron';
import { db } from '../../config/database.js';
import * as schema from '../../db/schema/index.js';
import { settingsService } from '../settings/settings.routes.js';
import { quoteService } from './investments.routes.js';

/** `stock_quotes` is a single global cache (not per-user), so this only needs one configured
 * Alpha Vantage key to refresh it — normally the one real user's, the demo account never has
 * API keys configured so it's simply skipped when checked. */
export function scheduleQuoteSync(): void {
  cron.schedule('30 3 * * *', async () => {
    const users = await db.select({ id: schema.users.id }).from(schema.users);

    let apiKey: string | null = null;
    for (const user of users) {
      apiKey = await settingsService.getValue(user.id, 'alphaVantageApiKey');
      if (apiKey) break;
    }
    if (!apiKey) return;

    try {
      await quoteService.refreshTrackedSymbols(apiKey);
      console.log('investments quote sync: done');
    } catch (err) {
      console.error('investments quote sync cron failed:', err);
    }
  });
}
