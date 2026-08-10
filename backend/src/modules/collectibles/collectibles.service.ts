import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { getPriceProvider } from '../../integrations/collectibles/price-router.service.js';
import { searchTcgdexCards } from '../../integrations/collectibles/tcgdex.provider.js';
import { AppError } from '../../shared/utils/AppError.js';
import type { SettingsService } from '../settings/settings.service.js';
import type {
  CreateCollectibleInput,
  ManualPriceUpdateInput,
  PerformanceQuery,
  UpdateCollectibleInput,
} from './collectibles.schema.js';

type CollectibleItem = typeof schema.collectibleItems.$inferSelect;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CollectiblesService {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly settingsService: SettingsService,
  ) {}

  async getConfig(userId: string) {
    const status = await this.settingsService.getStatus(userId);
    return {
      pokemonPriceTrackerConfigured: status.pokemonPriceTrackerConfigured,
      poketraceConfigured: status.poketraceConfigured,
    };
  }

  async list(userId: string, type?: 'card' | 'sealed') {
    const conditions = [eq(schema.collectibleItems.userId, userId)];
    if (type) conditions.push(eq(schema.collectibleItems.itemType, type));
    return this.db
      .select()
      .from(schema.collectibleItems)
      .where(and(...conditions));
  }

  async create(userId: string, input: CreateCollectibleInput) {
    const [item] = await this.db
      .insert(schema.collectibleItems)
      .values({ userId, ...input })
      .returning();
    return item;
  }

  async getById(userId: string, id: string): Promise<CollectibleItem> {
    const [item] = await this.db
      .select()
      .from(schema.collectibleItems)
      .where(and(eq(schema.collectibleItems.id, id), eq(schema.collectibleItems.userId, userId)));
    if (!item) throw new AppError(404, 'COLLECTIBLE_NOT_FOUND', 'Collectible item not found');
    return item;
  }

  async getWithHistory(userId: string, id: string) {
    const item = await this.getById(userId, id);
    const history = await this.db
      .select()
      .from(schema.collectiblePriceSnapshots)
      .where(eq(schema.collectiblePriceSnapshots.itemId, id))
      .orderBy(desc(schema.collectiblePriceSnapshots.fetchedAt));
    return { item, history };
  }

  async update(userId: string, id: string, input: UpdateCollectibleInput) {
    await this.getById(userId, id);
    const [item] = await this.db
      .update(schema.collectibleItems)
      .set(input)
      .where(eq(schema.collectibleItems.id, id))
      .returning();
    return item;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.db.delete(schema.collectibleItems).where(eq(schema.collectibleItems.id, id));
  }

  async updateManualPrice(userId: string, id: string, input: ManualPriceUpdateInput) {
    await this.getById(userId, id);
    const [snapshot] = await this.db
      .insert(schema.collectiblePriceSnapshots)
      .values({
        itemId: id,
        marketPriceEur: input.priceEur,
        marketPriceUsd: input.priceUsd ?? null,
        source: 'manual',
        rawData: input.note ? { note: input.note } : null,
      })
      .returning();
    return snapshot;
  }

  async syncPrices(userId: string) {
    const items = await this.db
      .select()
      .from(schema.collectibleItems)
      .where(
        and(
          eq(schema.collectibleItems.userId, userId),
          ne(schema.collectibleItems.priceSource, 'manual'),
        ),
      );

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    const [pokemonPriceTrackerApiKey, poketraceApiKey] = await Promise.all([
      this.settingsService.getValue(userId, 'pokemonPriceTrackerApiKey'),
      this.settingsService.getValue(userId, 'poketraceApiKey'),
    ]);
    const apiKeyByPriceSource: Partial<Record<CollectibleItem['priceSource'], string | null>> = {
      pokemonpricetracker: pokemonPriceTrackerApiKey,
      poketrace: poketraceApiKey,
    };

    for (const item of items) {
      const provider = getPriceProvider(item.priceSource);
      try {
        const result = await provider.fetchPrice(item, apiKeyByPriceSource[item.priceSource]);
        if (!result) {
          skipped++;
        } else {
          await this.db.insert(schema.collectiblePriceSnapshots).values({
            itemId: item.id,
            marketPriceEur: result.priceEurCents,
            marketPriceUsd: result.priceUsdCents,
            source: result.source,
            rawData: result.rawData,
          });
          synced++;
        }
      } catch (err) {
        errors++;
        console.error(`collectibles sync failed for item ${item.id}:`, err);
      }
      await sleep(500);
    }

    return { synced, skipped, errors };
  }

  // Gain/loss is computed from marketPriceEur only — snapshots that only carry
  // a USD price (e.g. PokemonPriceTracker) don't feed into it, since there's
  // no FX conversion in this app and purchasePrice is understood as EUR.
  async performance(userId: string, { sort, type }: PerformanceQuery) {
    const conditions = [eq(schema.collectibleItems.userId, userId)];
    if (type) conditions.push(eq(schema.collectibleItems.itemType, type));
    const items = await this.db
      .select()
      .from(schema.collectibleItems)
      .where(and(...conditions));

    if (items.length === 0) {
      return { items: [], totals: { totalInvested: 0, totalCurrentValue: 0, totalGainLossPct: 0 } };
    }

    const itemIds = items.map((i) => i.id);
    const snapshots = await this.db
      .select()
      .from(schema.collectiblePriceSnapshots)
      .where(inArray(schema.collectiblePriceSnapshots.itemId, itemIds))
      .orderBy(desc(schema.collectiblePriceSnapshots.fetchedAt));

    const latestByItem = new Map<string, (typeof snapshots)[number]>();
    for (const snap of snapshots) {
      if (!latestByItem.has(snap.itemId)) latestByItem.set(snap.itemId, snap);
    }

    const rows = items.map((item) => {
      const latest = latestByItem.get(item.id);
      const currentPrice = latest?.marketPriceEur ?? null;
      const gainLoss = currentPrice !== null ? currentPrice - item.purchasePrice : null;
      const gainLossPct =
        currentPrice !== null && item.purchasePrice > 0
          ? ((currentPrice - item.purchasePrice) / item.purchasePrice) * 100
          : null;
      return {
        id: item.id,
        name: item.name,
        itemType: item.itemType,
        purchasePrice: item.purchasePrice,
        currentPrice,
        gainLoss,
        gainLossPct,
      };
    });

    let sortedRows = rows;
    if (sort === 'best_performers') {
      sortedRows = [...rows].sort(
        (a, b) => (b.gainLossPct ?? -Infinity) - (a.gainLossPct ?? -Infinity),
      );
    } else if (sort === 'worst_performers') {
      sortedRows = [...rows].sort(
        (a, b) => (a.gainLossPct ?? Infinity) - (b.gainLossPct ?? Infinity),
      );
    }

    const totalInvested = items.reduce((sum, i) => sum + i.purchasePrice, 0);
    const totalCurrentValue = rows.reduce((sum, r) => sum + (r.currentPrice ?? r.purchasePrice), 0);
    const totalGainLossPct =
      totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;

    return {
      items: sortedRows,
      totals: { totalInvested, totalCurrentValue, totalGainLossPct },
    };
  }

  async searchCard(query: string, tcgType: string) {
    // TCGdex only covers Pokémon (verified against tcgdex.dev — see schema comment on
    // collectibleTcgTypeEnum) — other games have no search backend, manual entry only.
    if (tcgType !== 'pokemon') return [];
    return searchTcgdexCards(query);
  }
}
