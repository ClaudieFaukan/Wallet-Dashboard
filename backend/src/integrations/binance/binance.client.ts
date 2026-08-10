import crypto from 'node:crypto';

// Binance Spot API (https://binance-docs.github.io/apidocs/spot/en/#account-information-user_data).
// Read-only key usage: GET /api/v3/account, HMAC-SHA256 signed. Never exercised live (no API
// key at scaffold time) — signing scheme matches the public docs, unverified.
const API_BASE = 'https://api.binance.com';
const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'FDUSD']);

export interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

interface BinanceAccountResponse {
  balances: BinanceBalance[];
}

function sign(query: string, apiSecret: string): string {
  return crypto.createHmac('sha256', apiSecret).update(query).digest('hex');
}

/** Returns only assets with a nonzero (free + locked) balance. */
export async function getAccountBalances(
  apiKey: string,
  apiSecret: string,
): Promise<BinanceBalance[]> {
  const params = new URLSearchParams({ timestamp: Date.now().toString(), recvWindow: '5000' });
  params.set('signature', sign(params.toString(), apiSecret));

  const response = await fetch(`${API_BASE}/api/v3/account?${params.toString()}`, {
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  if (!response.ok) {
    throw new Error(`Binance request failed: ${response.status}`);
  }

  const data = (await response.json()) as BinanceAccountResponse;
  return data.balances.filter((b) => Number(b.free) + Number(b.locked) > 0);
}

/** USD price for one unit of `asset`, via its USDT spot pair. Stablecoins are treated as 1:1. */
export async function getAssetPriceUsd(asset: string): Promise<number | null> {
  if (STABLECOINS.has(asset)) return 1;
  try {
    const response = await fetch(`${API_BASE}/api/v3/ticker/price?symbol=${asset}USDT`);
    if (!response.ok) return null;
    const data = (await response.json()) as { price: string };
    return Number(data.price);
  } catch {
    return null;
  }
}
