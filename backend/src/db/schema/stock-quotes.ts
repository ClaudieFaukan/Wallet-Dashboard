import { pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { id } from './_helpers.js';

// Global cache (not user-scoped) of the latest Alpha Vantage quote per ticker — Alpha Vantage's
// free tier is 25 requests/day, so quotes are fetched at most once/day per symbol (see
// backend/src/modules/investments/quote.service.ts) rather than on every page load.
export const stockQuotes = pgTable('stock_quotes', {
  id: id(),
  symbol: text('symbol').notNull().unique(),
  price: real('price').notNull(),
  changePercent: real('change_percent').notNull(),
  // ISO currency the price is quoted in (e.g. "EUR", "USD", "GBP") — GLOBAL_QUOTE doesn't return
  // this, so it's resolved separately via Alpha Vantage's SYMBOL_SEARCH and cached forever once
  // known (a ticker's listing currency doesn't change). Null until resolved.
  currency: text('currency'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});
