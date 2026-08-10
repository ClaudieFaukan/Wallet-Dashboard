import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

export const investmentAccounts = pgTable('investment_accounts', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  platform: text('platform'),
  currentValue: integer('current_value').notNull().default(0),
  currency: text('currency').notNull().default('EUR'),
  ...timestamps,
});

export const investmentEntries = pgTable('investment_entries', {
  id: id(),
  investmentAccountId: uuid('investment_account_id')
    .notNull()
    .references(() => investmentAccounts.id, { onDelete: 'cascade' }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  amountInvested: integer('amount_invested').notNull(),
  portfolioValue: integer('portfolio_value').notNull(),
  notes: text('notes'),
  // Optional ETF/stock ticker (e.g. "IWDA.AS") — lets Alpha Vantage sync a live quote for it.
  ticker: text('ticker'),
  ...timestamps,
});

// amount stored in cents; conceptually the 20K / 50K / 100K / 1M milestones from base.md
export const investmentMilestones = pgTable('investment_milestones', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  reachedAt: timestamp('reached_at', { withTimezone: true }),
  ...timestamps,
});
