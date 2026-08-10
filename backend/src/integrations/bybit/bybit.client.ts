import crypto from 'node:crypto';

// Bybit V5 API (https://bybit-exchange.github.io/docs/v5/account/wallet-balance). Read-only key
// usage: GET /v5/account/wallet-balance?accountType=UNIFIED, HMAC-SHA256 signed
// (timestamp + apiKey + recvWindow + queryString). Never exercised live (no API key at scaffold
// time) — signing scheme matches the public docs, unverified. The unified wallet response
// conveniently includes each coin's USD value directly, no separate price lookup needed.
const API_BASE = 'https://api.bybit.com';
const RECV_WINDOW = '5000';

export interface BybitCoinBalance {
  coin: string;
  amount: number;
  valueUsd: number;
}

interface BybitWalletBalanceResponse {
  retCode: number;
  retMsg: string;
  result: { list: { coin: { coin: string; walletBalance: string; usdValue: string }[] }[] };
}

function sign(payload: string, apiSecret: string): string {
  return crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
}

export async function getWalletBalanceUsd(
  apiKey: string,
  apiSecret: string,
): Promise<BybitCoinBalance[]> {
  const timestamp = Date.now().toString();
  const query = 'accountType=UNIFIED';
  const signature = sign(timestamp + apiKey + RECV_WINDOW + query, apiSecret);

  const response = await fetch(`${API_BASE}/v5/account/wallet-balance?${query}`, {
    headers: {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-SIGN': signature,
      'X-BAPI-RECV-WINDOW': RECV_WINDOW,
    },
  });
  if (!response.ok) {
    throw new Error(`Bybit request failed: ${response.status}`);
  }

  const data = (await response.json()) as BybitWalletBalanceResponse;
  if (data.retCode !== 0) {
    throw new Error(`Bybit error: ${data.retMsg}`);
  }

  const coins = data.result.list[0]?.coin ?? [];
  return coins
    .filter((c) => Number(c.walletBalance) > 0)
    .map((c) => ({ coin: c.coin, amount: Number(c.walletBalance), valueUsd: Number(c.usdValue) }));
}
