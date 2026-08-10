import { date, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { id } from './_helpers.js';

// Global market data (not user-scoped) — one row per day, EUR-based rates
// fetched from the Frankfurter API. See integrations/frankfurter/.
export const exchangeRates = pgTable('exchange_rates', {
  id: id(),
  date: date('date').notNull().unique(),
  base: text('base').notNull().default('EUR'),
  rates: jsonb('rates').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});
