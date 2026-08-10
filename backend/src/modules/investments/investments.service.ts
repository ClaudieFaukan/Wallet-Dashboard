import { and, asc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { AppError } from '../../shared/utils/AppError.js';
import type {
  CreateEntryInput,
  CreateInvestmentAccountInput,
  ProjectionQuery,
  UpdateInvestmentAccountInput,
} from './investments.schema.js';

// 20K / 50K / 100K / 1M € in cents, tracked at the user level (across all of
// their investment accounts), per base.md's investment_milestones schema.
const MILESTONES_CENTS = [2_000_000, 5_000_000, 10_000_000, 100_000_000];

type InvestmentAccount = typeof schema.investmentAccounts.$inferSelect;

export class InvestmentsService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async list(userId: string) {
    return this.db
      .select()
      .from(schema.investmentAccounts)
      .where(eq(schema.investmentAccounts.userId, userId));
  }

  async create(userId: string, input: CreateInvestmentAccountInput) {
    const [account] = await this.db
      .insert(schema.investmentAccounts)
      .values({ userId, ...input })
      .returning();
    return account;
  }

  async getById(userId: string, id: string): Promise<InvestmentAccount> {
    const [account] = await this.db
      .select()
      .from(schema.investmentAccounts)
      .where(
        and(eq(schema.investmentAccounts.id, id), eq(schema.investmentAccounts.userId, userId)),
      );
    if (!account)
      throw new AppError(404, 'INVESTMENT_ACCOUNT_NOT_FOUND', 'Investment account not found');
    return account;
  }

  async update(userId: string, id: string, input: UpdateInvestmentAccountInput) {
    await this.getById(userId, id);
    const [account] = await this.db
      .update(schema.investmentAccounts)
      .set(input)
      .where(eq(schema.investmentAccounts.id, id))
      .returning();
    return account;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.db.delete(schema.investmentAccounts).where(eq(schema.investmentAccounts.id, id));
  }

  async addEntry(userId: string, accountId: string, input: CreateEntryInput) {
    await this.getById(userId, accountId);

    const [entry] = await this.db
      .insert(schema.investmentEntries)
      .values({
        investmentAccountId: accountId,
        date: new Date(input.date),
        amountInvested: input.amountInvested,
        portfolioValue: input.portfolioValue,
        notes: input.notes,
      })
      .returning();

    await this.db
      .update(schema.investmentAccounts)
      .set({ currentValue: input.portfolioValue })
      .where(eq(schema.investmentAccounts.id, accountId));

    const reachedMilestones = await this.checkMilestones(userId);
    return { entry, reachedMilestones };
  }

  async listEntries(userId: string, accountId: string) {
    await this.getById(userId, accountId);
    return this.db
      .select()
      .from(schema.investmentEntries)
      .where(eq(schema.investmentEntries.investmentAccountId, accountId))
      .orderBy(asc(schema.investmentEntries.date));
  }

  async getMilestones(userId: string) {
    const reached = await this.db
      .select()
      .from(schema.investmentMilestones)
      .where(eq(schema.investmentMilestones.userId, userId))
      .orderBy(schema.investmentMilestones.amount);
    const reachedAmounts = new Set(reached.map((r) => r.amount));

    const currentTotal = await this.getTotalValue(userId);
    const next = MILESTONES_CENTS.filter((m) => !reachedAmounts.has(m)).map((amount) => ({
      amount,
      progress: Math.min(currentTotal / amount, 1),
      missingAmount: Math.max(amount - currentTotal, 0),
    }));

    return { reached, next, currentTotal };
  }

  async getProjection(userId: string, accountId: string, params: ProjectionQuery) {
    const account = await this.getById(userId, accountId);
    const v0 = account.currentValue;
    const monthlyRate = params.annualRate / 12;
    const totalMonths = params.years * 12;
    const now = new Date();

    const points: { month: number; date: string; value: number }[] = [];
    const milestoneDates = new Map<number, string>();

    for (let t = 1; t <= totalMonths; t++) {
      const growthFactor = Math.pow(1 + monthlyRate, t);
      const value =
        monthlyRate === 0
          ? v0 + params.monthlyContribution * t
          : v0 * growthFactor + params.monthlyContribution * ((growthFactor - 1) / monthlyRate);
      const roundedValue = Math.round(value);

      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + t, 1));
      const dateString = date.toISOString().slice(0, 10);
      points.push({ month: t, date: dateString, value: roundedValue });

      for (const milestone of MILESTONES_CENTS) {
        if (!milestoneDates.has(milestone) && roundedValue >= milestone) {
          milestoneDates.set(milestone, dateString);
        }
      }
    }

    const milestones = MILESTONES_CENTS.map((amount) => ({
      amount,
      reached: v0 >= amount,
      estimatedDate: milestoneDates.get(amount) ?? null,
    }));

    return { points, milestones };
  }

  private async getTotalValue(userId: string): Promise<number> {
    const [row] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${schema.investmentAccounts.currentValue}), 0)::int`,
      })
      .from(schema.investmentAccounts)
      .where(eq(schema.investmentAccounts.userId, userId));
    return row?.total ?? 0;
  }

  private async checkMilestones(userId: string) {
    const total = await this.getTotalValue(userId);
    const crossed = MILESTONES_CENTS.filter((m) => total >= m);
    if (crossed.length === 0) return [];

    const existing = await this.db
      .select({ amount: schema.investmentMilestones.amount })
      .from(schema.investmentMilestones)
      .where(eq(schema.investmentMilestones.userId, userId));
    const existingAmounts = new Set(existing.map((e) => e.amount));

    const newRows = crossed
      .filter((m) => !existingAmounts.has(m))
      .map((amount) => ({ userId, amount, reachedAt: new Date() }));
    if (newRows.length === 0) return [];

    return this.db.insert(schema.investmentMilestones).values(newRows).returning();
  }
}
