import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { getFrankfurterRates } from '../../integrations/frankfurter/frankfurter.client.js';

const BASE_CURRENCY = 'EUR';
// USD/CAD were the original display-currency choices; GBP/CHF added so investment quotes from
// tickers listed on the LSE/SIX can be converted too (see investments quote.service.ts) — same
// free Frankfurter call, no extra cost to track a few more.
const DISPLAY_CURRENCIES = ['USD', 'CAD', 'GBP', 'CHF'] as const;

export interface ExchangeRatesResult {
  date: string;
  base: string;
  rates: Record<string, number>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class ExchangeRatesService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async getLatest(): Promise<ExchangeRatesResult> {
    const date = today();
    const [row] = await this.db
      .select()
      .from(schema.exchangeRates)
      .where(eq(schema.exchangeRates.date, date));
    if (row) {
      return { date: row.date, base: row.base, rates: row.rates as Record<string, number> };
    }
    return this.refresh();
  }

  async refresh(): Promise<ExchangeRatesResult> {
    const date = today();
    const fetched = await getFrankfurterRates(BASE_CURRENCY, [...DISPLAY_CURRENCIES]);
    const rates = { [BASE_CURRENCY]: 1, ...fetched };

    const [row] = await this.db
      .insert(schema.exchangeRates)
      .values({ date, base: BASE_CURRENCY, rates })
      .onConflictDoUpdate({
        target: schema.exchangeRates.date,
        set: { rates, fetchedAt: new Date() },
      })
      .returning();

    return { date: row!.date, base: row!.base, rates: row!.rates as Record<string, number> };
  }
}
