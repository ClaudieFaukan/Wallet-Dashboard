import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
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
}
