import cron from 'node-cron';
import { db } from '../../config/database.js';
import * as schema from '../../db/schema/index.js';
import { settingsService } from '../settings/settings.routes.js';
import { CollectiblesService } from './collectibles.service.js';

const collectiblesService = new CollectiblesService(db, settingsService);

/** Single-user app (see AuthService.register) — sync runs for whichever one user exists. */
export function scheduleCollectiblesSync(): void {
  cron.schedule('0 3 * * *', async () => {
    const [user] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
    if (!user) return;

    try {
      const result = await collectiblesService.syncPrices(user.id);
      console.log(
        `collectibles sync-prices: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`,
      );
    } catch (err) {
      console.error('collectibles sync-prices cron failed:', err);
    }
  });
}
