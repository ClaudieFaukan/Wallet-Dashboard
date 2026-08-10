import { eq, isNotNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { getQuote as fetchQuote } from '../../integrations/alphavantage/alphavantage.client.js';
import { AppError } from '../../shared/utils/AppError.js';
import type { SettingsService } from '../settings/settings.service.js';

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
) {
  const [row] = await db
    .insert(schema.stockQuotes)
    .values({ symbol, price, changePercent })
    .onConflictDoUpdate({
      target: schema.stockQuotes.symbol,
      set: { price, changePercent, fetchedAt: new Date() },
    })
    .returning();
  return row;
}

export class QuoteService {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly settingsService: SettingsService,
  ) {}

  /** Serves today's cached quote if present, otherwise fetches live (requires a configured key). */
  async getQuote(userId: string, symbol: string) {
    const [cached] = await this.db
      .select()
      .from(schema.stockQuotes)
      .where(eq(schema.stockQuotes.symbol, symbol));
    if (cached && isToday(cached.fetchedAt)) return cached;

    const apiKey = await this.settingsService.getValue(userId, 'alphaVantageApiKey');
    if (!apiKey) {
      throw new AppError(
        501,
        'ALPHA_VANTAGE_NOT_CONFIGURED',
        'Alpha Vantage sync is not configured yet',
      );
    }

    const quote = await fetchQuote(symbol, apiKey);
    return upsertQuote(this.db, symbol, quote.price, quote.changePercent);
  }

  /** Refreshes every ticker referenced by an investment entry — used by the daily cron. */
  async refreshTrackedSymbols(apiKey: string): Promise<void> {
    const rows = await this.db
      .selectDistinct({ ticker: schema.investmentEntries.ticker })
      .from(schema.investmentEntries)
      .where(isNotNull(schema.investmentEntries.ticker));
    const symbols = rows.map((r) => r.ticker).filter((t): t is string => Boolean(t));

    for (const symbol of symbols) {
      try {
        const quote = await fetchQuote(symbol, apiKey);
        await upsertQuote(this.db, symbol, quote.price, quote.changePercent);
      } catch (err) {
        console.error(`stock quote sync failed for ${symbol}:`, err);
      }
      // Stay well under Alpha Vantage's free-tier 5 requests/minute cap.
      await sleep(15_000);
    }
  }
}
