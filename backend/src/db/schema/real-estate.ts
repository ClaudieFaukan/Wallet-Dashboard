import { date, integer, pgEnum, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

export const realEstateTypeEnum = pgEnum('real_estate_type', ['physical', 'scpi', 'crowdfunding']);

export const realEstateAssets = pgTable('real_estate_assets', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: realEstateTypeEnum('type').notNull(),
  // Crowdfunding platform (e.g. 'brick', 'mapremierebrique') — null for physical/SCPI.
  platform: text('platform'),
  purchasePrice: integer('purchase_price').notNull(),
  currentValue: integer('current_value').notNull(),
  purchaseDate: date('purchase_date').notNull(),
  monthlyIncome: integer('monthly_income').notNull().default(0),
  // Physical-only fields.
  surfaceM2: real('surface_m2'),
  location: text('location'),
  notes: text('notes'),
  ...timestamps,
});

// SCPI/crowdfunding prices are published 1-2x/year and updated manually (docs/feat1.md FEAT-12) —
// each manual update appends a row here instead of silently overwriting currentValue, same
// pattern as investment_entries/savings_deposits.
export const realEstateValueHistory = pgTable('real_estate_value_history', {
  id: id(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => realEstateAssets.id, { onDelete: 'cascade' }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  value: integer('value').notNull(),
  notes: text('notes'),
  ...timestamps,
});
