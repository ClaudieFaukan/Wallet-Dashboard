import { eq, isNotNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import {
  getQuote as fetchQuote,
  searchSymbolCurrency,
} from '../../integrations/alphavantage/alphavantage.client.js';
import { AppError } from '../../shared/utils/AppError.js';
import type { SettingsService } from '../settings/settings.service.js';

// Stay under Alpha Vantage's free-tier 25 requests/day cap on the cron batch, leaving headroom
// for on-demand getQuote() calls triggered by page views throughout the day.
const DAILY_BATCH_LIMIT = 20;

function isToday(date: Date): boolean {
  return date.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertQuote(
  db: NodePgDatabase<typeof schema>,
  symbol: string,
  price: number,
  changePercent: number,
  currency: string | null,
) {
  const [row] = await db
    .insert(schema.stockQuotes)
    .values({ symbol, price, changePercent, currency })
    .onConflictDoUpdate({
      target: schema.stockQuotes.symbol,
      // currency is only overwritten when newly resolved — never clobbers an already-known
      // value with null (e.g. a lookup that failed this run shouldn't erase a past success).
      set: { price, changePercent, fetchedAt: new Date(), ...(currency ? { currency } : {}) },
    })
    .returning();
  return row;
}

export class QuoteService {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly settingsService: SettingsService,
  ) {}

  // GLOBAL_QUOTE never reports what currency its price is in — resolved once via SYMBOL_SEARCH
  // and cached forever after (a ticker's listing currency doesn't change). Swallows failures so
  // a currency lookup issue never breaks the price fetch itself.
  private async resolveCurrency(
    symbol: string,
    existingCurrency: string | null | undefined,
    apiKey: string,
  ): Promise<string | null> {
    if (existingCurrency) return existingCurrency;
    try {
      return await searchSymbolCurrency(symbol, apiKey);
    } catch (err) {
      console.error(`currency lookup failed for ${symbol}:`, err);
      return null;
    }
  }

  /** Serves today's cached quote if present, otherwise fetches live (requires a configured key). */
  async getQuote(userId: string, symbol: string) {
    const [cached] = await this.db
      .select()
      .from(schema.stockQuotes)
      .where(eq(schema.stockQuotes.symbol, symbol));
    if (cached && isToday(cached.fetchedAt) && cached.currency) return cached;

    const apiKey = await this.settingsService.getValue(userId, 'alphaVantageApiKey');
    if (!apiKey) {
      if (cached && isToday(cached.fetchedAt)) return cached; // fresh price, just missing currency
      throw new AppError(
        501,
        'ALPHA_VANTAGE_NOT_CONFIGURED',
        'Alpha Vantage sync is not configured yet',
      );
    }

    if (cached && isToday(cached.fetchedAt)) {
      // Price is already fresh — only the currency is missing, resolve it without re-fetching the quote.
      const currency = await this.resolveCurrency(symbol, cached.currency, apiKey);
      return currency ? upsertQuote(this.db, symbol, cached.price, cached.changePercent, currency) : cached;
    }

    const quote = await fetchQuote(symbol, apiKey);
    const currency = await this.resolveCurrency(symbol, cached?.currency, apiKey);
    return upsertQuote(this.db, symbol, quote.price, quote.changePercent, currency);
  }

  /** Refreshes the least-recently-updated tracked tickers first — used by the daily cron, capped
   * to stay under the free-tier quota so a large watchlist doesn't starve some tickers forever. */
  async refreshTrackedSymbols(apiKey: string): Promise<void> {
    const rows = await this.db
      .selectDistinct({ ticker: schema.investmentEntries.ticker })
      .from(schema.investmentEntries)
      .where(isNotNull(schema.investmentEntries.ticker));
    const trackedSymbols = rows.map((r) => r.ticker).filter((t): t is string => Boolean(t));
    if (trackedSymbols.length === 0) return;

    const cachedRows = await this.db
      .select({
        symbol: schema.stockQuotes.symbol,
        currency: schema.stockQuotes.currency,
        fetchedAt: schema.stockQuotes.fetchedAt,
      })
      .from(schema.stockQuotes);
    const cacheBySymbol = new Map(cachedRows.map((r) => [r.symbol, r]));

    // Never-fetched symbols first (-Infinity sorts before any real timestamp), then oldest
    // fetchedAt — a round-robin so the same handful of tickers don't monopolize the daily quota.
    const prioritized = [...trackedSymbols].sort((a, b) => {
      const aTime = cacheBySymbol.get(a)?.fetchedAt.getTime() ?? -Infinity;
      const bTime = cacheBySymbol.get(b)?.fetchedAt.getTime() ?? -Infinity;
      return aTime - bTime;
    });
    const batch = prioritized.slice(0, DAILY_BATCH_LIMIT);

    for (const symbol of batch) {
      try {
        const quote = await fetchQuote(symbol, apiKey);
        const currency = await this.resolveCurrency(symbol, cacheBySymbol.get(symbol)?.currency, apiKey);
        await upsertQuote(this.db, symbol, quote.price, quote.changePercent, currency);
      } catch (err) {
        console.error(`stock quote sync failed for ${symbol}:`, err);
      }
      // Stay well under Alpha Vantage's free-tier 5 requests/minute cap.
      await sleep(15_000);
    }
  }
}
