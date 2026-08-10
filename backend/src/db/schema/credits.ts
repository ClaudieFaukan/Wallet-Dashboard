import { integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

export const credits = pgTable('credits', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  institution: text('institution').notNull(),
  initialAmount: integer('initial_amount').notNull(),
  remainingAmount: integer('remaining_amount').notNull(),
  monthlyPayment: integer('monthly_payment').notNull(),
  // Fraction, not a percentage (0.035 = 3.5%) — same convention as investments' annualRate.
  interestRate: real('interest_rate').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  earlyRepaymentFeeRate: real('early_repayment_fee_rate').notNull().default(0),
  currency: text('currency').notNull().default('EUR'),
  ...timestamps,
});

export const creditPayments = pgTable('credit_payments', {
  id: id(),
  creditId: uuid('credit_id')
    .notNull()
    .references(() => credits.id, { onDelete: 'cascade' }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  amount: integer('amount').notNull(),
  principalPart: integer('principal_part').notNull(),
  interestPart: integer('interest_part').notNull(),
  ...timestamps,
});
