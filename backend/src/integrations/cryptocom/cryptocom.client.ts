import crypto from 'node:crypto';

// Crypto.com Exchange API v1, read-only usage. Signing verified against the
// official docs (method+id+api_key+paramString+nonce, HMAC-SHA256, id/nonce
// sent as *strings* in the body per "all numbers must be quoted strings").
// Still returns 501 in crypto.service.ts: a live test against a real account
// failed with a generic {"code":50001,"message":"ERR_INTERNAL"} even with a
// docs-correct signature — likely an account-side issue (wrong key type/App
// vs Exchange key, missing permission, or IP allowlist), not a code bug, but
// unconfirmed. Do not unstub without re-testing against a real account first.

const API_BASE = 'https://api.crypto.com/exchange/v1';

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

export async function getAccountSummary(apiKey: string, apiSecret: string): Promise<unknown> {
  const method = 'private/get-account-summary';
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

  return response.json();
}
