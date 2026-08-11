import crypto from 'node:crypto';

// Crypto.com Exchange API v1, read-only usage. Signing verified against the
// official docs (method+id+api_key+paramString+nonce, HMAC-SHA256, id/nonce
// sent as *strings* in the body per "all numbers must be quoted strings").
//
// Root cause found 2026-08-11 for the {"code":50001,"message":"ERR_INTERNAL"}
// that blocked this integration since étape 8: `private/get-account-summary`
// is a deprecated method from the old Spot v2.1 API — Crypto.com's own
// migration guide (Spot v2.1 → Exchange v1) confirms it was replaced by
// `private/user-balance`, which returns a real 200 against the real account's
// key (verified live). Not a key/product mismatch after all.
//
// `private/user-balance` reports the account's unified margin/derivatives
// balance — `total_cash_balance` is the field used here as the wallet's
// total value (real number, not a total we invent). Per-currency detail
// (`position_balances[]`) is parsed best-effort via `instrument_name`/
// `quantity` (Crypto.com's usual naming for position entries elsewhere in
// this API family) — unconfirmed against a real non-empty array since the
// test account currently has Spot disabled (`spot_enabled: false` via
// `private/get-accounts`), so verify field names again once it holds a
// real balance before trusting the per-token breakdown.
const API_BASE = 'https://api.crypto.com/exchange/v1';

export interface CryptoComPositionBalance {
  instrument_name: string;
  quantity: string;
}

export interface CryptoComBalance {
  instrument_name: string;
  total_cash_balance: string;
  total_available_balance: string;
  position_balances: CryptoComPositionBalance[];
}

interface CryptoComBalanceResponse {
  code: number;
  result: { data: CryptoComBalance[] };
}

function sign(
  method: string,
  id: number,
  apiKey: string,
  params: Record<string, unknown>,
  nonce: number,
  apiSecret: string,
): string {
  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${key}${String(params[key])}`)
    .join('');
  const payload = `${method}${id}${apiKey}${paramString}${nonce}`;
  return crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
}

async function call<T>(method: string, apiKey: string, apiSecret: string): Promise<T> {
  const id = Date.now();
  const nonce = Date.now();
  const params = {};
  const sig = sign(method, id, apiKey, params, nonce, apiSecret);

  const response = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: String(id),
      method,
      api_key: apiKey,
      params,
      nonce: String(nonce),
      sig,
    }),
  });
  if (!response.ok) {
    throw new Error(`Crypto.com API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/** The account's unified balance (one entry per instrument — a single "USD" entry
 * for a standard retail account). Returns the first entry, or a zeroed placeholder
 * if the account has none yet (e.g. Spot not enabled). */
export async function getUserBalance(apiKey: string, apiSecret: string): Promise<CryptoComBalance> {
  const data = await call<CryptoComBalanceResponse>('private/user-balance', apiKey, apiSecret);
  return (
    data.result.data[0] ?? {
      instrument_name: 'USD',
      total_cash_balance: '0',
      total_available_balance: '0',
      position_balances: [],
    }
  );
}
