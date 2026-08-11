// Meria (mymeria.fr) personal account API — read-only, no OAuth/HMAC, just a
// single API key generated from the user's dashboard (Mon compte > API) sent
// as the "API-KEY" header. Docs at https://docs.meria.com/ (blocks non-browser
// fetches with a 403, confirmed by hand — endpoint/shape below taken from
// Meria's own help center + indexed doc snippets, not verified live yet).
const API_BASE = 'https://api.meria.com/v1';

export interface MeriaWallet {
  currencyCode: string;
  balance: number;
}

interface MeriaWalletsResponse {
  success: boolean;
  data: MeriaWallet[];
}

/** Returns every currency balance held on the user's Meria account, including zero balances. */
export async function getWallets(apiKey: string): Promise<MeriaWallet[]> {
  const response = await fetch(`${API_BASE}/wallets`, {
    headers: { 'API-KEY': apiKey },
  });
  if (!response.ok) {
    throw new Error(`Meria request failed: ${response.status}`);
  }

  const data = (await response.json()) as MeriaWalletsResponse;
  return data.data.filter((w) => w.balance > 0);
}
