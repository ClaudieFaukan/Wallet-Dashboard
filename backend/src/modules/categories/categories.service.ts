import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { AppError } from '../../shared/utils/AppError.js';
import type { CreateCategoryInput } from './categories.schema.js';

export class CategoriesService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async list(userId: string) {
    return this.db.select().from(schema.categories).where(eq(schema.categories.userId, userId));
  }

  async create(userId: string, input: CreateCategoryInput) {
    const [category] = await this.db
      .insert(schema.categories)
      .values({ userId, ...input })
      .returning();
    return category;
  }

  async delete(userId: string, id: string): Promise<void> {
    const [category] = await this.db
      .select()
      .from(schema.categories)
      .where(and(eq(schema.categories.id, id), eq(schema.categories.userId, userId)));
    if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    if (category.isDefault) {
      throw new AppError(403, 'CATEGORY_IS_DEFAULT', 'Default categories cannot be deleted');
    }
    await this.db.delete(schema.categories).where(eq(schema.categories.id, id));
  }
}
