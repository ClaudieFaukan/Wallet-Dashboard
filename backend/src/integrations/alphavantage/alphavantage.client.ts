// Alpha Vantage GLOBAL_QUOTE endpoint (https://www.alphavantage.co/documentation/#latestprice).
// Free tier: 25 requests/day, 5/minute — response shape is well-documented and stable, but this
// has never been exercised against a real key (none provided at scaffold time), unverified live.
const API_BASE = 'https://www.alphavantage.co/query';

export interface StockQuote {
  symbol: string;
  price: number;
  changePercent: number;
}

interface AlphaVantageGlobalQuoteResponse {
  'Global Quote'?: {
    '01. symbol': string;
    '05. price': string;
    '10. change percent': string;
  };
  Note?: string;
  Information?: string;
}

export async function getQuote(symbol: string, apiKey: string): Promise<StockQuote> {
  const url = new URL(API_BASE);
  url.searchParams.set('function', 'GLOBAL_QUOTE');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed: ${response.status}`);
  }

  const data = (await response.json()) as AlphaVantageGlobalQuoteResponse;
  const quote = data['Global Quote'];
  if (!quote?.['05. price']) {
    throw new Error(data.Note ?? data.Information ?? `No quote data for ${symbol}`);
  }

  return {
    symbol,
    price: Number(quote['05. price']),
    changePercent: Number(quote['10. change percent'].replace('%', '')),
  };
}

interface AlphaVantageSymbolSearchResponse {
  bestMatches?: { '1. symbol': string; '8. currency': string }[];
  Note?: string;
  Information?: string;
}

// GLOBAL_QUOTE never says what currency its price is in (a ".AS" ticker is EUR, a bare US
// ticker is USD, ".L" is GBP...) — SYMBOL_SEARCH is the only Alpha Vantage endpoint that
// returns a currency, so it's used once per new ticker to resolve and cache it permanently.
export async function searchSymbolCurrency(symbol: string, apiKey: string): Promise<string | null> {
  const url = new URL(API_BASE);
  url.searchParams.set('function', 'SYMBOL_SEARCH');
  url.searchParams.set('keywords', symbol);
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed: ${response.status}`);
  }

  const data = (await response.json()) as AlphaVantageSymbolSearchResponse;
  if (data.Note || data.Information) throw new Error(data.Note ?? data.Information);

  const exactMatch = data.bestMatches?.find((m) => m['1. symbol'] === symbol);
  return exactMatch?.['8. currency'] ?? null;
}
