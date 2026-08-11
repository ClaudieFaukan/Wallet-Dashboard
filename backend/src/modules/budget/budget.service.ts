import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { AppError } from '../../shared/utils/AppError.js';
import type { CreateBudgetLineInput, UpdateBudgetLineInput } from './budget.schema.js';

type BudgetPeriod = typeof schema.budgetPeriods.$inferSelect;

function toMonthDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** Accepts 'YYYY-MM' (query/body param from the client) and normalizes to the
 * 'YYYY-MM-01' shape the `budget_periods.month` column stores. */
function normalizeMonth(month: string | undefined): string {
  if (!month) return toMonthDate(new Date());
  return `${month}-01`;
}

/** [start, end) UTC bounds for the calendar month a `month` column value falls in. */
function monthBounds(monthDate: string): [Date, Date] {
  const start = new Date(`${monthDate}T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return [start, end];
}

export class BudgetService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async getCurrent(userId: string, month?: string) {
    const period = await this.getOrCreatePeriod(userId, normalizeMonth(month));
    return this.buildBudgetView(userId, period);
  }

  async getYearly(userId: string, year: number) {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;

    const periods = await this.db
      .select({
        month: schema.budgetPeriods.month,
        totalPlanned: schema.budgetPeriods.totalPlanned,
      })
      .from(schema.budgetPeriods)
      .where(
        and(
          eq(schema.budgetPeriods.userId, userId),
          gte(schema.budgetPeriods.month, yearStart),
          lt(schema.budgetPeriods.month, yearEnd),
        ),
      );

    /** Same sign fix as `buildBudgetView`: only expense transactions, negated to a
     * positive "spent" figure so it's directly comparable to `totalPlanned`. */
    const actuals = await this.db
      .select({
        month: sql<string>`to_char(${schema.transactions.date}, 'YYYY-MM')`,
        total: sql<number>`sum(-${schema.transactions.amount})::int`,
      })
      .from(schema.transactions)
      .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.transactions.type, 'expense'),
          gte(schema.transactions.date, new Date(`${yearStart}T00:00:00.000Z`)),
          lt(schema.transactions.date, new Date(`${yearEnd}T00:00:00.000Z`)),
        ),
      )
      .groupBy(sql`to_char(${schema.transactions.date}, 'YYYY-MM')`);

    const plannedByMonth = new Map(periods.map((p) => [p.month.slice(0, 7), p.totalPlanned]));
    const actualByMonth = new Map(actuals.map((a) => [a.month, a.total]));

    return Array.from({ length: 12 }, (_, i) => {
      const month = `${year}-${String(i + 1).padStart(2, '0')}`;
      const totalPlanned = plannedByMonth.get(month) ?? 0;
      const totalActual = actualByMonth.get(month) ?? 0;
      return { month, totalPlanned, totalActual, variance: totalActual - totalPlanned };
    });
  }

  async addLine(userId: string, input: CreateBudgetLineInput) {
    const period = await this.getOrCreatePeriod(userId, normalizeMonth(input.month));

    const [category] = await this.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(and(eq(schema.categories.id, input.categoryId), eq(schema.categories.userId, userId)));
    if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');

    const [line] = await this.db
      .insert(schema.budgetLines)
      .values({
        budgetPeriodId: period.id,
        categoryId: input.categoryId,
        plannedAmount: input.plannedAmount,
      })
      .returning();

    await this.recomputeTotalPlanned(period.id);
    return line;
  }

  async updateLine(userId: string, lineId: string, input: UpdateBudgetLineInput) {
    const periodId = await this.getLineOwnerPeriodId(userId, lineId);

    const [updated] = await this.db
      .update(schema.budgetLines)
      .set({ plannedAmount: input.plannedAmount })
      .where(eq(schema.budgetLines.id, lineId))
      .returning();

    await this.recomputeTotalPlanned(periodId);
    return updated;
  }

  async deleteLine(userId: string, lineId: string): Promise<void> {
    const periodId = await this.getLineOwnerPeriodId(userId, lineId);

    await this.db.delete(schema.budgetLines).where(eq(schema.budgetLines.id, lineId));

    await this.recomputeTotalPlanned(periodId);
  }

  private async getLineOwnerPeriodId(userId: string, lineId: string): Promise<string> {
    const [row] = await this.db
      .select({ periodId: schema.budgetPeriods.id })
      .from(schema.budgetLines)
      .innerJoin(
        schema.budgetPeriods,
        eq(schema.budgetLines.budgetPeriodId, schema.budgetPeriods.id),
      )
      .where(and(eq(schema.budgetLines.id, lineId), eq(schema.budgetPeriods.userId, userId)));
    if (!row) throw new AppError(404, 'BUDGET_LINE_NOT_FOUND', 'Budget line not found');
    return row.periodId;
  }

  private async getOrCreatePeriod(userId: string, monthDate: string): Promise<BudgetPeriod> {
    const [existing] = await this.db
      .select()
      .from(schema.budgetPeriods)
      .where(
        and(eq(schema.budgetPeriods.userId, userId), eq(schema.budgetPeriods.month, monthDate)),
      );
    if (existing) return existing;

    const [previous] = await this.db
      .select()
      .from(schema.budgetPeriods)
      .where(
        and(eq(schema.budgetPeriods.userId, userId), lt(schema.budgetPeriods.month, monthDate)),
      )
      .orderBy(desc(schema.budgetPeriods.month))
      .limit(1);

    const [period] = await this.db
      .insert(schema.budgetPeriods)
      .values({ userId, month: monthDate, totalIncome: 0, totalPlanned: 0 })
      .returning();
    if (!period) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create budget period');

    if (previous) {
      const previousLines = await this.db
        .select()
        .from(schema.budgetLines)
        .where(eq(schema.budgetLines.budgetPeriodId, previous.id));

      if (previousLines.length > 0) {
        await this.db.insert(schema.budgetLines).values(
          previousLines.map((l) => ({
            budgetPeriodId: period.id,
            categoryId: l.categoryId,
            plannedAmount: l.plannedAmount,
          })),
        );
        await this.recomputeTotalPlanned(period.id);
        return {
          ...period,
          totalPlanned: previousLines.reduce((sum, l) => sum + l.plannedAmount, 0),
        };
      }
    }

    return period;
  }

  private async buildBudgetView(userId: string, period: BudgetPeriod) {
    const [monthStart, monthEnd] = monthBounds(period.month);

    /** Expense transactions are stored with a negative `amount` — negate so
     * `actualAmount` is a positive "spent so far" figure, directly comparable
     * to `plannedAmount` (both hero totals and per-line progress bars rely on this). */
    const actuals = await this.db
      .select({
        categoryId: schema.transactions.categoryId,
        total: sql<number>`sum(-${schema.transactions.amount})::int`,
      })
      .from(schema.transactions)
      .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.transactions.type, 'expense'),
          gte(schema.transactions.date, monthStart),
          lt(schema.transactions.date, monthEnd),
        ),
      )
      .groupBy(schema.transactions.categoryId);

    const actualByCategory = new Map(actuals.map((a) => [a.categoryId, a.total]));

    /** Per-day expense totals for the "cumulative spend vs budget" chart —
     * only non-zero days are returned, the client fills the gaps. */
    const dailyRows = await this.db
      .select({
        day: sql<number>`extract(day from ${schema.transactions.date})::int`,
        total: sql<number>`sum(-${schema.transactions.amount})::int`,
      })
      .from(schema.transactions)
      .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.transactions.type, 'expense'),
          gte(schema.transactions.date, monthStart),
          lt(schema.transactions.date, monthEnd),
        ),
      )
      .groupBy(sql`extract(day from ${schema.transactions.date})`);
    const dailySpend = dailyRows.map((r) => ({ day: r.day, amount: r.total }));

    const lines = await this.db
      .select({ line: schema.budgetLines, category: schema.categories })
      .from(schema.budgetLines)
      .innerJoin(schema.categories, eq(schema.budgetLines.categoryId, schema.categories.id))
      .where(eq(schema.budgetLines.budgetPeriodId, period.id));

    const lineViews = lines.map(({ line, category }) => ({
      id: line.id,
      categoryId: line.categoryId,
      categoryName: category.name,
      plannedAmount: line.plannedAmount,
      actualAmount: actualByCategory.get(line.categoryId) ?? 0,
    }));

    const totalActual = actuals.reduce((sum, a) => sum + a.total, 0);

    return {
      id: period.id,
      month: period.month,
      totalIncome: period.totalIncome,
      totalPlanned: period.totalPlanned,
      totalActual,
      lines: lineViews,
      dailySpend,
    };
  }

  private async recomputeTotalPlanned(periodId: string): Promise<void> {
    const [result] = await this.db
      .select({ total: sql<number>`coalesce(sum(${schema.budgetLines.plannedAmount}), 0)::int` })
      .from(schema.budgetLines)
      .where(eq(schema.budgetLines.budgetPeriodId, periodId));

    await this.db
      .update(schema.budgetPeriods)
      .set({ totalPlanned: result?.total ?? 0 })
      .where(eq(schema.budgetPeriods.id, periodId));
  }
}
