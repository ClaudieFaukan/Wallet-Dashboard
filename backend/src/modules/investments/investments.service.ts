import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { AppError } from '../../shared/utils/AppError.js';
import type {
  CreateEntryInput,
  CreateInvestmentAccountInput,
  CreateInvestmentGoalInput,
  ProjectionQuery,
  UpdateEntryInput,
  UpdateInvestmentAccountInput,
  UpdateInvestmentGoalInput,
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
        entryType: input.entryType,
        notes: input.notes,
        ticker: input.ticker,
        assetType: input.assetType,
        isin: input.isin,
        shares: input.shares,
      })
      .returning();

    await this.recomputeCurrentValue(accountId);

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

  async updateEntry(userId: string, accountId: string, entryId: string, input: UpdateEntryInput) {
    await this.getEntryOrThrow(userId, accountId, entryId);

    const [entry] = await this.db
      .update(schema.investmentEntries)
      .set({
        ...(input.date !== undefined && { date: new Date(input.date) }),
        ...(input.amountInvested !== undefined && { amountInvested: input.amountInvested }),
        ...(input.portfolioValue !== undefined && { portfolioValue: input.portfolioValue }),
        ...(input.entryType !== undefined && { entryType: input.entryType }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.ticker !== undefined && { ticker: input.ticker }),
        ...(input.assetType !== undefined && { assetType: input.assetType }),
        ...(input.isin !== undefined && { isin: input.isin }),
        ...(input.shares !== undefined && { shares: input.shares }),
      })
      .where(eq(schema.investmentEntries.id, entryId))
      .returning();

    await this.recomputeCurrentValue(accountId);
    return entry;
  }

  async deleteEntry(userId: string, accountId: string, entryId: string): Promise<void> {
    await this.getEntryOrThrow(userId, accountId, entryId);
    await this.db.delete(schema.investmentEntries).where(eq(schema.investmentEntries.id, entryId));
    await this.recomputeCurrentValue(accountId);
  }

  private async getEntryOrThrow(userId: string, accountId: string, entryId: string) {
    await this.getById(userId, accountId);
    const [entry] = await this.db
      .select()
      .from(schema.investmentEntries)
      .where(
        and(
          eq(schema.investmentEntries.id, entryId),
          eq(schema.investmentEntries.investmentAccountId, accountId),
        ),
      );
    if (!entry) throw new AppError(404, 'INVESTMENT_ENTRY_NOT_FOUND', 'Investment entry not found');
    return entry;
  }

  // The account's "current value" always mirrors the portfolioValue of its most recent entry
  // by date (or 0 with no entries left) — kept consistent after every add/edit/delete.
  private async recomputeCurrentValue(accountId: string): Promise<void> {
    const [latest] = await this.db
      .select({ portfolioValue: schema.investmentEntries.portfolioValue })
      .from(schema.investmentEntries)
      .where(eq(schema.investmentEntries.investmentAccountId, accountId))
      .orderBy(desc(schema.investmentEntries.date))
      .limit(1);

    await this.db
      .update(schema.investmentAccounts)
      .set({ currentValue: latest?.portfolioValue ?? 0 })
      .where(eq(schema.investmentAccounts.id, accountId));
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

  async listGoals(userId: string) {
    return this.db
      .select()
      .from(schema.investmentGoals)
      .where(eq(schema.investmentGoals.userId, userId))
      .orderBy(asc(schema.investmentGoals.createdAt));
  }

  async createGoal(userId: string, input: CreateInvestmentGoalInput) {
    const [goal] = await this.db
      .insert(schema.investmentGoals)
      .values({ userId, ...input })
      .returning();
    return goal;
  }

  async updateGoal(userId: string, id: string, input: UpdateInvestmentGoalInput) {
    await this.getGoalOrThrow(userId, id);
    const [goal] = await this.db
      .update(schema.investmentGoals)
      .set(input)
      .where(eq(schema.investmentGoals.id, id))
      .returning();
    return goal;
  }

  async deleteGoal(userId: string, id: string): Promise<void> {
    await this.getGoalOrThrow(userId, id);
    await this.db.delete(schema.investmentGoals).where(eq(schema.investmentGoals.id, id));
  }

  private async getGoalOrThrow(userId: string, id: string) {
    const [goal] = await this.db
      .select()
      .from(schema.investmentGoals)
      .where(and(eq(schema.investmentGoals.id, id), eq(schema.investmentGoals.userId, userId)));
    if (!goal) throw new AppError(404, 'INVESTMENT_GOAL_NOT_FOUND', 'Investment goal not found');
    return goal;
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
