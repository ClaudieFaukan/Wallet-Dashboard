import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { parseCsv } from '../../integrations/csv/csv.parser.js';
import { AppError } from '../../shared/utils/AppError.js';
import type { SettingsService } from '../settings/settings.service.js';
import type { CreateAccountInput, UpdateAccountInput } from './accounts.schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export class AccountsService {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly settingsService: SettingsService,
  ) {}

  async list(userId: string) {
    return this.db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  }

  async create(userId: string, input: CreateAccountInput) {
    const [account] = await this.db
      .insert(schema.accounts)
      .values({ userId, ...input })
      .returning();
    return account;
  }

  async getById(userId: string, id: string) {
    const [account] = await this.db
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, userId)));
    if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
    return account;
  }

  async update(userId: string, id: string, input: UpdateAccountInput) {
    await this.getById(userId, id);
    const [account] = await this.db
      .update(schema.accounts)
      .set(input)
      .where(eq(schema.accounts.id, id))
      .returning();
    return account;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.db.delete(schema.accounts).where(eq(schema.accounts.id, id));
  }

  /** One balance snapshot per day for the last `days` days, oldest first. */
  async balanceHistory(userId: string, id: string, days: number) {
    const account = await this.getById(userId, id);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const since = new Date(today.getTime() - days * DAY_MS);

    const rows = await this.db
      .select({ date: schema.transactions.date, amount: schema.transactions.amount })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.accountId, id), gte(schema.transactions.date, since)))
      .orderBy(desc(schema.transactions.date));

    const points: { date: string; balance: number }[] = [];
    let runningBalance = account.balance;
    let txIndex = 0;

    for (let dayStart = today.getTime(); dayStart >= since.getTime(); dayStart -= DAY_MS) {
      const nextDayStart = dayStart + DAY_MS;
      while (txIndex < rows.length && rows[txIndex]!.date.getTime() >= nextDayStart) {
        runningBalance -= rows[txIndex]!.amount;
        txIndex++;
      }
      points.push({ date: new Date(dayStart).toISOString().slice(0, 10), balance: runningBalance });
    }

    return points.reverse();
  }

  async importCsv(userId: string, accountId: string, fileContent: string) {
    const account = await this.getById(userId, accountId);
    const { transactions } = parseCsv(fileContent);

    const externalIds = transactions.map((t) => t.externalId);
    const existing = externalIds.length
      ? await this.db
          .select({ externalId: schema.transactions.externalId })
          .from(schema.transactions)
          .where(
            and(
              eq(schema.transactions.accountId, accountId),
              inArray(schema.transactions.externalId, externalIds),
            ),
          )
      : [];
    const existingIds = new Set(existing.map((e) => e.externalId));
    const toInsert = transactions.filter((t) => !existingIds.has(t.externalId));

    if (toInsert.length > 0) {
      await this.db.insert(schema.transactions).values(
        toInsert.map((t) => ({
          accountId,
          amount: t.amountCents,
          currency: account.currency,
          type: t.type,
          description: t.description,
          date: t.date,
          source: 'csv_import' as const,
          externalId: t.externalId,
        })),
      );
    }

    return {
      imported: toInsert.length,
      skipped: transactions.length - toInsert.length,
      total: transactions.length,
    };
  }

  async syncRevolut(userId: string, accountId: string): Promise<never> {
    await this.getById(userId, accountId);
    // Full OAuth PKCE + fetch/persist wiring is deferred to a dedicated session
    // once real Revolut Developer credentials exist (see integrations/revolut/revolut.client.ts).
    const clientId = await this.settingsService.getValue(userId, 'revolutClientId');
    if (!clientId) {
      throw new AppError(501, 'REVOLUT_NOT_CONFIGURED', 'Revolut sync is not configured yet');
    }
    throw new AppError(501, 'REVOLUT_NOT_CONFIGURED', 'Revolut sync is not implemented yet');
  }
}
