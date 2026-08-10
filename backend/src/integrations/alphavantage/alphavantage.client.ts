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
