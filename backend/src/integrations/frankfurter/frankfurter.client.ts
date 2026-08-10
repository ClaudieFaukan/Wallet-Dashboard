// Frankfurter API (https://www.frankfurter.app) — free, no API key, daily
// ECB reference rates. `base` -> 1 unit of `base` in each of `symbols`.
const API_BASE = 'https://api.frankfurter.app';

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export async function getFrankfurterRates(
  base: string,
  symbols: string[],
): Promise<Record<string, number>> {
  const url = new URL(`${API_BASE}/latest`);
  url.searchParams.set('from', base);
  url.searchParams.set('to', symbols.join(','));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Frankfurter request failed: ${response.status}`);
  }

  const data = (await response.json()) as FrankfurterResponse;
  return data.rates;
}
