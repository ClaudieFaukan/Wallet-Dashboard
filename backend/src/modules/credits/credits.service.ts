import { and, asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { AppError } from '../../shared/utils/AppError.js';
import type {
  CreateCreditInput,
  RecordPaymentInput,
  SimulationQuery,
  UpdateCreditInput,
} from './credits.schema.js';

// Matches base.md's DCA default rate — used for the "invest the freed monthly
// payment" comparison, same assumption as the investments module's projection.
const INVESTMENT_ANNUAL_RATE = 0.07;

type Credit = typeof schema.credits.$inferSelect;

function monthsBetween(from: Date, to: Date): number {
  return Math.max(
    0,
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()),
  );
}

/** Standard fixed-payment amortization balance after `t` months, given the loan's current balance/rate/payment. */
function balanceAfter(balance: number, monthlyPayment: number, monthlyRate: number, t: number): number {
  if (t <= 0) return balance;
  if (monthlyRate === 0) return Math.max(balance - monthlyPayment * t, 0);
  const growth = Math.pow(1 + monthlyRate, t);
  return Math.max(Math.round(balance * growth - monthlyPayment * ((growth - 1) / monthlyRate)), 0);
}

/** Value of a monthly DCA contribution after `months` of compounding at `monthlyRate`. */
function dcaValue(monthlyContribution: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return monthlyContribution * months;
  const growth = Math.pow(1 + monthlyRate, months);
  return Math.round(monthlyContribution * ((growth - 1) / monthlyRate));
}

export class CreditsService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async list(userId: string) {
    return this.db.select().from(schema.credits).where(eq(schema.credits.userId, userId));
  }

  async create(userId: string, input: CreateCreditInput) {
    const [credit] = await this.db
      .insert(schema.credits)
      .values({
        userId,
        ...input,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      })
      .returning();
    return credit;
  }

  async getById(userId: string, id: string): Promise<Credit> {
    const [credit] = await this.db
      .select()
      .from(schema.credits)
      .where(and(eq(schema.credits.id, id), eq(schema.credits.userId, userId)));
    if (!credit) throw new AppError(404, 'CREDIT_NOT_FOUND', 'Credit not found');
    return credit;
  }

  async update(userId: string, id: string, input: UpdateCreditInput) {
    await this.getById(userId, id);
    const { startDate, endDate, ...rest } = input;
    const [credit] = await this.db
      .update(schema.credits)
      .set({
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      })
      .where(eq(schema.credits.id, id))
      .returning();
    return credit;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.db.delete(schema.credits).where(eq(schema.credits.id, id));
  }

  async recordPayment(userId: string, id: string, input: RecordPaymentInput) {
    const credit = await this.getById(userId, id);
    const [payment] = await this.db
      .insert(schema.creditPayments)
      .values({ creditId: id, ...input, date: new Date(input.date) })
      .returning();

    const [updated] = await this.db
      .update(schema.credits)
      .set({ remainingAmount: Math.max(credit.remainingAmount - input.principalPart, 0) })
      .where(eq(schema.credits.id, id))
      .returning();

    return { payment, credit: updated };
  }

  async listPayments(userId: string, id: string) {
    await this.getById(userId, id);
    return this.db
      .select()
      .from(schema.creditPayments)
      .where(eq(schema.creditPayments.creditId, id))
      .orderBy(asc(schema.creditPayments.date));
  }

  async getSimulation(userId: string, id: string, params: SimulationQuery) {
    const credit = await this.getById(userId, id);
    const today = new Date();
    const totalMonthsRemaining = monthsBetween(today, credit.endDate);
    const n = Math.min(
      Math.max(monthsBetween(today, new Date(params.earlyRepaymentDate)), 0),
      totalMonthsRemaining,
    );

    const monthlyRate = credit.interestRate / 12;
    const investmentMonthlyRate = INVESTMENT_ANNUAL_RATE / 12;

    const totalRemaining = balanceAfter(credit.remainingAmount, credit.monthlyPayment, monthlyRate, n);
    const scheduledRemainingPayments = (totalMonthsRemaining - n) * credit.monthlyPayment;
    const interestSaved = Math.max(scheduledRemainingPayments - totalRemaining, 0);
    const earlyRepaymentFee = Math.round(totalRemaining * credit.earlyRepaymentFeeRate);
    const netGain = interestSaved - earlyRepaymentFee;
    const freedMonthlyBudget = credit.monthlyPayment;
    const investMonths = totalMonthsRemaining - n;
    const investmentProjection = dcaValue(freedMonthlyBudget, investmentMonthlyRate, investMonths);

    const points: { month: number; date: string; doNothing: number; earlyRepayment: number }[] = [];
    for (let t = 0; t <= totalMonthsRemaining; t++) {
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + t, 1));
      const doNothing = -balanceAfter(credit.remainingAmount, credit.monthlyPayment, monthlyRate, t);
      const earlyRepayment =
        t <= n
          ? doNothing
          : -earlyRepaymentFee + dcaValue(freedMonthlyBudget, investmentMonthlyRate, t - n);
      points.push({ month: t, date: date.toISOString().slice(0, 10), doNothing, earlyRepayment });
    }

    return {
      earlyRepaymentDate: params.earlyRepaymentDate,
      monthsUntilRepayment: n,
      totalRemaining,
      interestSaved,
      earlyRepaymentFee,
      netGain,
      freedMonthlyBudget,
      investmentProjection,
      points,
    };
  }
}
