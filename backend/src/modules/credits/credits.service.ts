import { and, asc, eq, isNotNull, notInArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { normalizeLetters } from '../../integrations/pdf/label.js';
import { AppError } from '../../shared/utils/AppError.js';
import type {
  CreateCreditInput,
  RecordPaymentInput,
  SimulationQuery,
  UpdateCreditInput,
} from './credits.schema.js';

// Postgres error code for a unique-constraint violation (pg driver attaches it to the thrown
// error) — used to recognize "this transaction is already linked" without a pre-check query.
const UNIQUE_VIOLATION = '23505';

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

/** The longest word in an institution name, normalized — used as a stand-in for "the
 * distinctive part of the name" (see findSuggestedPayments). Words under 4 letters are ignored
 * so a name with no real distinctive word (rare) doesn't fall back to matching on noise. */
function institutionKeyword(institution: string): string {
  const words = institution
    .split(/[^\p{L}]+/u)
    .map(normalizeLetters)
    .filter((w) => w.length >= 4);
  return words.reduce((longest, w) => (w.length > longest.length ? w : longest), '');
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

  /** Unlinked expense transactions across every account this user owns that look like a
   * repayment of this credit — matched by an exact amount match (a fixed loan installment is the
   * same amount every month, so this is reliable) or by the credit's institution name appearing
   * in the transaction description. Deliberately not a loose amount tolerance: verified live
   * against real data that a percentage-based tolerance (even a few euros on a ~45€ payment)
   * false-matched an unrelated phone bill and a grocery purchase that just happened to land
   * within a couple euros of the credit's monthly payment by coincidence — a false suggestion is
   * worse than a missed one, since nothing stops the user from linking it. Never links anything
   * by itself — this only surfaces candidates for the user to confirm via linkPayment,
   * consistent with the rest of the app never mutating financial data without a confirm step
   * (see the PDF import mapping screen). */
  async findSuggestedPayments(userId: string, id: string) {
    const credit = await this.getById(userId, id);

    const linkedRows = await this.db
      .select({ transactionId: schema.creditPayments.transactionId })
      .from(schema.creditPayments)
      .where(isNotNull(schema.creditPayments.transactionId));
    const linkedIds = linkedRows.map((r) => r.transactionId!);

    const candidates = await this.db
      .select({
        id: schema.transactions.id,
        amount: schema.transactions.amount,
        description: schema.transactions.description,
        date: schema.transactions.date,
      })
      .from(schema.transactions)
      .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.transactions.type, 'expense'),
          linkedIds.length > 0 ? notInArray(schema.transactions.id, linkedIds) : undefined,
        ),
      )
      .orderBy(asc(schema.transactions.date));

    // The institution's most distinctive word, not the full name — verified live against real
    // data: "Younited Crédit" (the institution) never appears verbatim in a transaction
    // description like "CB YOUNITED FACT 090626", only the brand word "Younited" does. The
    // longest word is used as a proxy for "distinctive" (generic banking words like "Crédit" or
    // "Banque" that commonly prefix French institution names are usually the shorter ones).
    const institutionKey = institutionKeyword(credit.institution);

    const matches = candidates.filter((t) => {
      const amountMatches = Math.abs(t.amount) === credit.monthlyPayment;
      const keywordMatches =
        institutionKey.length > 0 && normalizeLetters(t.description ?? '').includes(institutionKey);
      return amountMatches || keywordMatches;
    });

    // Preview the principal/interest split each match would get if linked — simulated in date
    // order against a running balance (mirrors linkPayment's real computation) without touching
    // the database, since a batch of suggestions needs a distinct split per payment even though
    // remainingAmount only actually decreases once a payment is really linked.
    const monthlyRate = credit.interestRate / 12;
    let runningRemaining = credit.remainingAmount;
    return matches.map((t) => {
      const amount = Math.abs(t.amount);
      const interestPart = Math.min(amount, Math.round(runningRemaining * monthlyRate));
      const principalPart = amount - interestPart;
      runningRemaining = Math.max(runningRemaining - principalPart, 0);
      return {
        transactionId: t.id,
        date: t.date,
        amount,
        description: t.description,
        principalPart,
        interestPart,
      };
    });
  }

  /** Links an existing bank transaction to this credit as a payment — the principal/interest
   * split is derived from the credit's current rate/balance rather than asked of the user, since
   * the transaction already fixes the payment amount and date. */
  async linkPayment(userId: string, id: string, transactionId: string) {
    const credit = await this.getById(userId, id);

    const [txn] = await this.db
      .select({
        id: schema.transactions.id,
        amount: schema.transactions.amount,
        date: schema.transactions.date,
      })
      .from(schema.transactions)
      .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .where(and(eq(schema.transactions.id, transactionId), eq(schema.accounts.userId, userId)));
    if (!txn) throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');

    const monthlyRate = credit.interestRate / 12;
    const amount = Math.abs(txn.amount);
    const interestPart = Math.min(amount, Math.round(credit.remainingAmount * monthlyRate));
    const principalPart = amount - interestPart;

    let payment: typeof schema.creditPayments.$inferSelect | undefined;
    try {
      [payment] = await this.db
        .insert(schema.creditPayments)
        .values({ creditId: id, transactionId, date: txn.date, amount, principalPart, interestPart })
        .returning();
    } catch (err) {
      // Drizzle wraps the underlying pg error (which carries the Postgres error code) in `.cause`
      // rather than exposing `.code` directly on the thrown DrizzleQueryError — verified live,
      // checking err.code alone silently fell through to a generic 500 instead of a 409.
      const pgCode = (err as { code?: string; cause?: { code?: string } }).cause?.code;
      if (pgCode === UNIQUE_VIOLATION) {
        throw new AppError(
          409,
          'TRANSACTION_ALREADY_LINKED',
          'This transaction is already linked to a credit payment',
        );
      }
      throw err;
    }

    const [updatedCredit] = await this.db
      .update(schema.credits)
      .set({ remainingAmount: Math.max(credit.remainingAmount - principalPart, 0) })
      .where(eq(schema.credits.id, id))
      .returning();

    return { payment: payment!, credit: updatedCredit };
  }

  /** Reverses a payment (manual or linked) — gives back the principal it had paid down. Also
   * the only way to undo a mistaken link/manual entry, since neither has any other edit path. */
  async unlinkPayment(userId: string, id: string, paymentId: string) {
    const credit = await this.getById(userId, id);
    const [payment] = await this.db
      .select()
      .from(schema.creditPayments)
      .where(and(eq(schema.creditPayments.id, paymentId), eq(schema.creditPayments.creditId, id)));
    if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');

    await this.db.delete(schema.creditPayments).where(eq(schema.creditPayments.id, paymentId));

    const [updatedCredit] = await this.db
      .update(schema.credits)
      .set({ remainingAmount: credit.remainingAmount + payment.principalPart })
      .where(eq(schema.credits.id, id))
      .returning();

    return updatedCredit;
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
