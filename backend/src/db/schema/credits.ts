import { sql } from 'drizzle-orm';
import { integer, pgTable, real, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { transactions } from './transactions.js';
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

export const creditPayments = pgTable(
  'credit_payments',
  {
    id: id(),
    creditId: uuid('credit_id')
      .notNull()
      .references(() => credits.id, { onDelete: 'cascade' }),
    date: timestamp('date', { withTimezone: true }).notNull(),
    amount: integer('amount').notNull(),
    principalPart: integer('principal_part').notNull(),
    interestPart: integer('interest_part').notNull(),
    // Set when this payment was linked to an actual imported bank transaction (see
    // CreditsService.linkPayment) rather than entered by hand — nullable so manual entries stay
    // supported. `onDelete: 'set null'` rather than cascade: if the source transaction is ever
    // deleted, the payment (and the capital it already paid down) should still stand, just
    // without a source to point back to.
    transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    // A transaction can only ever pay down one credit once — prevents the same bank transaction
    // being linked twice (to the same or a different credit) and double-counting principal.
    uniqueIndex('credit_payments_transaction_id_idx')
      .on(table.transactionId)
      .where(sql`${table.transactionId} is not null`),
  ],
);
