import { and, desc, eq, gte, ilike, lt, lte, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { AppError } from '../../shared/utils/AppError.js';
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  StatsQuery,
  UpdateTransactionInput,
} from './transactions.schema.js';

interface Cursor {
  date: string;
  id: string;
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(raw: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (!parsed.date || !parsed.id) throw new Error('invalid');
    return { date: parsed.date, id: parsed.id };
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'Invalid pagination cursor');
  }
}

export class TransactionsService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  private async assertAccountOwnership(userId: string, accountId: string): Promise<void> {
    const [account] = await this.db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.userId, userId)));
    if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
  }

  async create(userId: string, input: CreateTransactionInput) {
    await this.assertAccountOwnership(userId, input.accountId);
    const [transaction] = await this.db
      .insert(schema.transactions)
      .values({ ...input, date: new Date(input.date) })
      .returning();
    return transaction;
  }

  async list(userId: string, query: ListTransactionsQuery) {
    const conditions = [eq(schema.accounts.userId, userId)];
    if (query.accountId) conditions.push(eq(schema.transactions.accountId, query.accountId));
    if (query.categoryId) conditions.push(eq(schema.transactions.categoryId, query.categoryId));
    if (query.type) conditions.push(eq(schema.transactions.type, query.type));
    if (query.dateFrom) conditions.push(gte(schema.transactions.date, new Date(query.dateFrom)));
    if (query.dateTo) conditions.push(lte(schema.transactions.date, new Date(query.dateTo)));
    if (query.search) conditions.push(ilike(schema.transactions.description, `%${query.search}%`));

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      const cursorDate = new Date(cursor.date);
      conditions.push(
        or(
          lt(schema.transactions.date, cursorDate),
          and(eq(schema.transactions.date, cursorDate), lt(schema.transactions.id, cursor.id)),
        )!,
      );
    }

    const rows = await this.db
      .select({ transaction: schema.transactions })
      .from(schema.transactions)
      .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .where(and(...conditions))
      .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit).map((r) => r.transaction);
    const last = items.at(-1);
    const nextCursor =
      hasMore && last ? encodeCursor({ date: last.date.toISOString(), id: last.id }) : undefined;

    return { items, nextCursor, hasMore };
  }

  async getById(userId: string, id: string) {
    const [row] = await this.db
      .select({ transaction: schema.transactions })
      .from(schema.transactions)
      .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .where(and(eq(schema.transactions.id, id), eq(schema.accounts.userId, userId)));
    if (!row) throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
    return row.transaction;
  }

  async update(userId: string, id: string, input: UpdateTransactionInput) {
    await this.getById(userId, id);
    const { date, ...rest } = input;
    const values = date ? { ...rest, date: new Date(date) } : rest;
    const [transaction] = await this.db
      .update(schema.transactions)
      .set(values)
      .where(eq(schema.transactions.id, id))
      .returning();
    return transaction;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.db.delete(schema.transactions).where(eq(schema.transactions.id, id));
  }

  async stats(userId: string, query: StatsQuery) {
    const conditions = [eq(schema.accounts.userId, userId)];
    if (query.dateFrom) conditions.push(gte(schema.transactions.date, new Date(query.dateFrom)));
    if (query.dateTo) conditions.push(lte(schema.transactions.date, new Date(query.dateTo)));

    const byCategory = await this.db
      .select({
        categoryId: schema.transactions.categoryId,
        categoryName: schema.categories.name,
        total: sql<number>`sum(${schema.transactions.amount})::int`,
      })
      .from(schema.transactions)
      .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .where(and(...conditions))
      .groupBy(schema.transactions.categoryId, schema.categories.name);

    const byMonth = await this.db
      .select({
        month: sql<string>`to_char(${schema.transactions.date}, 'YYYY-MM')`,
        totalIncome: sql<number>`sum(case when ${schema.transactions.amount} > 0 then ${schema.transactions.amount} else 0 end)::int`,
        totalExpense: sql<number>`sum(case when ${schema.transactions.amount} < 0 then ${schema.transactions.amount} else 0 end)::int`,
      })
      .from(schema.transactions)
      .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .where(and(...conditions))
      .groupBy(sql`to_char(${schema.transactions.date}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${schema.transactions.date}, 'YYYY-MM')`);

    return { byCategory, byMonth };
  }
}
