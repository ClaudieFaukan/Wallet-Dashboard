import { integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

export const investmentAssetTypeEnum = pgEnum('investment_asset_type', ['stock', 'etf']);
export const investmentEntryTypeEnum = pgEnum('investment_entry_type', [
  'contribution',
  'dividend',
  'fee',
]);

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
  // 'dividend' entries carry the dividend amount in amountInvested but are excluded from
  // "total invested" (cost basis) sums everywhere — a dividend isn't money out of the user's pocket.
  // 'fee' entries carry a broker fee (management/custody/transaction) — also excluded from cost
  // basis, tallied separately as "Frais prélevés" so it doesn't inflate performance calculations.
  entryType: investmentEntryTypeEnum('entry_type').notNull().default('contribution'),
  notes: text('notes'),
  // Optional ETF/stock ticker (e.g. "IWDA.AS") — lets Alpha Vantage sync a live quote for it.
  ticker: text('ticker'),
  assetType: investmentAssetTypeEnum('asset_type'),
  // ISIN of the underlying security (e.g. "FR0000131104"), as shown by the broker.
  isin: text('isin'),
  // Number of shares/units this entry represents — fractional (some brokers allow partial shares).
  shares: numeric('shares', { precision: 18, scale: 6, mode: 'number' }),
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

// User-defined targets (e.g. "Indépendance financière" 500K€) — not in base.md, tracked against
// the sum of all of the user's investment accounts (like investmentMilestones), unlike
// savingsGoals which store their own currentAmount fed by manual deposits.
export const investmentGoals = pgTable('investment_goals', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetAmount: integer('target_amount').notNull(),
  color: text('color'),
  ...timestamps,
});
