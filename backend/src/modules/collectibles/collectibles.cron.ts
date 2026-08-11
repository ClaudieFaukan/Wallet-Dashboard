import cron from 'node-cron';
import { db } from '../../config/database.js';
import * as schema from '../../db/schema/index.js';
import { settingsService } from '../settings/settings.routes.js';
import { CollectiblesService } from './collectibles.service.js';

const collectiblesService = new CollectiblesService(db, settingsService);

/** Runs for every registered user (normally just one — see AuthService.register — plus the
 * demo account from FEAT-09, which simply has no API keys configured and no-ops). */
export function scheduleCollectiblesSync(): void {
  cron.schedule('0 3 * * *', async () => {
    const users = await db.select({ id: schema.users.id }).from(schema.users);

    for (const user of users) {
      try {
        const result = await collectiblesService.syncPrices(user.id);
        console.log(
          `collectibles sync-prices (${user.id}): ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`,
        );
      } catch (err) {
        console.error(`collectibles sync-prices cron failed for ${user.id}:`, err);
      }
    }
  });
}
