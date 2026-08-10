import { and, asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { AppError } from '../../shared/utils/AppError.js';
import type {
  CreateRealEstateAssetInput,
  RecordValueInput,
  UpdateRealEstateAssetInput,
} from './real-estate.schema.js';

type RealEstateAsset = typeof schema.realEstateAssets.$inferSelect;

export class RealEstateService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async list(userId: string) {
    return this.db
      .select()
      .from(schema.realEstateAssets)
      .where(eq(schema.realEstateAssets.userId, userId));
  }

  async create(userId: string, input: CreateRealEstateAssetInput) {
    const [asset] = await this.db
      .insert(schema.realEstateAssets)
      .values({
        userId,
        ...input,
        purchaseDate: input.purchaseDate.slice(0, 10),
      })
      .returning();
    return asset;
  }

  async getById(userId: string, id: string): Promise<RealEstateAsset> {
    const [asset] = await this.db
      .select()
      .from(schema.realEstateAssets)
      .where(and(eq(schema.realEstateAssets.id, id), eq(schema.realEstateAssets.userId, userId)));
    if (!asset) throw new AppError(404, 'REAL_ESTATE_ASSET_NOT_FOUND', 'Real estate asset not found');
    return asset;
  }

  async update(userId: string, id: string, input: UpdateRealEstateAssetInput) {
    await this.getById(userId, id);
    const { purchaseDate, ...rest } = input;
    const [asset] = await this.db
      .update(schema.realEstateAssets)
      .set({ ...rest, ...(purchaseDate ? { purchaseDate: purchaseDate.slice(0, 10) } : {}) })
      .where(eq(schema.realEstateAssets.id, id))
      .returning();
    return asset;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.db.delete(schema.realEstateAssets).where(eq(schema.realEstateAssets.id, id));
  }

  async recordValue(userId: string, id: string, input: RecordValueInput) {
    await this.getById(userId, id);

    const [point] = await this.db
      .insert(schema.realEstateValueHistory)
      .values({ assetId: id, date: new Date(input.date), value: input.value, notes: input.notes })
      .returning();

    const [asset] = await this.db
      .update(schema.realEstateAssets)
      .set({ currentValue: input.value })
      .where(eq(schema.realEstateAssets.id, id))
      .returning();

    return { point, asset };
  }

  async history(userId: string, id: string) {
    await this.getById(userId, id);
    return this.db
      .select()
      .from(schema.realEstateValueHistory)
      .where(eq(schema.realEstateValueHistory.assetId, id))
      .orderBy(asc(schema.realEstateValueHistory.date));
  }
}
