import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/config/database.js';
import * as schema from '../src/db/schema/index.js';

const app = createApp();

async function registerAndGetToken() {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/v1/auth/register')
    .send({ email: 'test@example.com', password: 'correcthorsebattery', name: 'Test User' });
  const accessToken = res.body.data.accessToken as string;
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, 'test@example.com'));
  return { agent, accessToken, userId: user!.id };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('crypto module', () => {
  describe('CRUD', () => {
    it('creates, gets, updates and deletes a wallet', async () => {
      const { agent, accessToken } = await registerAndGetToken();

      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Mon wallet Phantom',
          platform: 'phantom',
          address: 'SomeSolAddr',
          chain: 'solana',
        });
      expect(createRes.status).toBe(201);
      const walletId = createRes.body.data.id as string;

      const getRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe('Mon wallet Phantom');

      const patchRes = await agent
        .patch(`/api/v1/crypto/wallets/${walletId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Wallet principal' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.name).toBe('Wallet principal');

      const deleteRes = await agent
        .delete(`/api/v1/crypto/wallets/${walletId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent
        .get(`/api/v1/crypto/wallets/${walletId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterDelete.status).toBe(404);
    });

    it("rejects access to another user's wallet", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignWallet] = await db
        .insert(schema.cryptoWallets)
        .values({
          userId: otherUser!.id,
          name: 'Not yours',
          platform: 'phantom',
          address: 'x',
          chain: 'solana',
        })
        .returning();

      const res = await agent
        .get(`/api/v1/crypto/wallets/${foreignWallet!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /wallets/:id/sync', () => {
    it('syncs a Phantom/Solana wallet (native SOL only) and stores a snapshot', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Phantom', platform: 'phantom', address: 'SomeSolAddr', chain: 'solana' });
      const walletId = createRes.body.data.id as string;

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, options?: { body?: string }) => {
          const urlStr = String(url);
          // CoinGecko's coin list is cached process-wide for 24h — always return the same
          // canonical superset here so whichever test happens to prime the cache first doesn't
          // starve a later test that needs a different symbol resolved (e.g. 'btc'/'eth').
          if (urlStr.includes('/coins/list')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                  { id: 'solana', symbol: 'sol', name: 'Solana' },
                ]),
            });
          }
          if (urlStr.includes('/coins/markets')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'solana', symbol: 'sol', name: 'Solana', image: 'sol.png', current_price: 100, price_change_percentage_24h: 1 },
                ]),
            });
          }
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          if (body.method === 'getBalance') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ result: { value: 2_000_000_000 } }), // 2 SOL
            });
          }
          if (body.method === 'getTokenAccountsByOwner') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: [] } }) });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );

      const syncRes = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(syncRes.status).toBe(200);
      // 2 SOL * $100 = $200 = 20000 cents
      expect(syncRes.body.data.totalValueUsd).toBe(20000);

      const historyRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/history`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data).toHaveLength(1);
      expect(historyRes.body.data[0].totalValueUsd).toBe(20000);
    });

    it('includes SPL token value (not just native SOL) in the sync total', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Phantom', platform: 'phantom', address: 'SomeSolAddr', chain: 'solana' });
      const walletId = createRes.body.data.id as string;
      const mint = 'UsdcMintAddress11111111111111111111111111';

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, options?: { body?: string }) => {
          const urlStr = String(url);
          if (urlStr.includes('/coins/list')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                  { id: 'solana', symbol: 'sol', name: 'Solana' },
                ]),
            });
          }
          if (urlStr.includes('/coins/markets')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'solana', symbol: 'sol', name: 'Solana', image: 'sol.png', current_price: 100, price_change_percentage_24h: 1 },
                ]),
            });
          }
          if (urlStr.includes(`/coins/solana/contract/${mint}`)) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  symbol: 'usdc',
                  name: 'USD Coin',
                  image: { small: 'usdc.png' },
                  market_data: { current_price: { usd: 5 }, price_change_percentage_24h: 0.5 },
                }),
            });
          }
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          if (body.method === 'getBalance') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ result: { value: 2_000_000_000 } }), // 2 SOL
            });
          }
          if (body.method === 'getTokenAccountsByOwner') {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  result: {
                    value: [
                      {
                        account: {
                          data: { parsed: { info: { mint, tokenAmount: { uiAmount: 10, decimals: 6 } } } },
                        },
                      },
                    ],
                  },
                }),
            });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );

      const syncRes = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(syncRes.status).toBe(200);
      // (2 SOL * $100) + (10 tokens * $5) = $250 = 25000 cents
      expect(syncRes.body.data.totalValueUsd).toBe(25000);
    });

    it('resolves native SOL to real Solana even when a decoy coin shares the same ticker', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Phantom', platform: 'phantom', address: 'SomeSolAddr', chain: 'solana' });
      const walletId = createRes.body.data.id as string;

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, options?: { body?: string }) => {
          const urlStr = String(url);
          if (urlStr.includes('/coins/list')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  // A decoy listed before real Solana, sharing the same "sol" ticker — the exact
                  // collision reproduced live (an obscure wrapped-SOL bridge token), which used
                  // to make native SOL price/name resolve to this instead of the real thing.
                  { id: 'allbridge-bridged-sol-near-protocol', symbol: 'sol', name: 'Allbridge Bridged SOL (Near Protocol)' },
                  { id: 'solana', symbol: 'sol', name: 'Solana' },
                ]),
            });
          }
          if (urlStr.includes('/coins/markets')) {
            const ids = new URL(urlStr).searchParams.get('ids');
            expect(ids).toBe('solana');
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'solana', symbol: 'sol', name: 'Solana', image: 'sol.png', current_price: 150, price_change_percentage_24h: 2 },
                ]),
            });
          }
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          if (body.method === 'getBalance') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ result: { value: 1_000_000_000 } }), // 1 SOL
            });
          }
          if (body.method === 'getTokenAccountsByOwner') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: [] } }) });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );

      const tokensRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/tokens`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(tokensRes.status).toBe(200);
      expect(tokensRes.body.data.tokens).toHaveLength(1);
      expect(tokensRes.body.data.tokens[0].name).toBe('Solana');
      expect(tokensRes.body.data.tokens[0].priceUsd).toBe(150);
    });

    it('resolves an SPL token to its real name/symbol by mint address, not a truncated placeholder', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Phantom', platform: 'phantom', address: 'SomeSolAddr', chain: 'solana' });
      const walletId = createRes.body.data.id as string;
      // The real Solana USDT mint — resolving this by ticker (its raw mint prefix "Es9v…wNYB"
      // isn't a ticker at all) would never work, which is exactly the bug being guarded against.
      const usdtMint = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, options?: { body?: string }) => {
          const urlStr = String(url);
          if (urlStr.includes('/coins/list')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                  { id: 'solana', symbol: 'sol', name: 'Solana' },
                ]),
            });
          }
          if (urlStr.includes('/coins/markets')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          }
          if (urlStr.includes(`/coins/solana/contract/${usdtMint}`)) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  symbol: 'usdt',
                  name: 'Tether USD',
                  image: { small: 'usdt.png' },
                  market_data: { current_price: { usd: 1 }, price_change_percentage_24h: 0.1 },
                }),
            });
          }
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          if (body.method === 'getBalance') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: 0 } }) });
          }
          if (body.method === 'getTokenAccountsByOwner') {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  result: {
                    value: [
                      {
                        account: {
                          data: {
                            parsed: { info: { mint: usdtMint, tokenAmount: { uiAmount: 5, decimals: 6 } } },
                          },
                        },
                      },
                    ],
                  },
                }),
            });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );

      const tokensRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/tokens`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(tokensRes.status).toBe(200);
      expect(tokensRes.body.data.tokens).toHaveLength(1);
      expect(tokensRes.body.data.tokens[0].symbol).toBe('USDT');
      expect(tokensRes.body.data.tokens[0].name).toBe('Tether USD');
      expect(tokensRes.body.data.tokens[0].priceUsd).toBe(1);
    });

    it('excludes spam SPL token accounts (no CoinGecko price, no resolved name) from the sync total', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Phantom', platform: 'phantom', address: 'SomeSolAddr', chain: 'solana' });
      const walletId = createRes.body.data.id as string;
      const spamMint = 'SpamMintAddress1111111111111111111111111';

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, options?: { body?: string }) => {
          const urlStr = String(url);
          if (urlStr.includes('/coins/list')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                  { id: 'solana', symbol: 'sol', name: 'Solana' },
                ]),
            });
          }
          if (urlStr.includes('/coins/markets')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          }
          if (urlStr.includes('/simple/token_price/')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); // no listing
          }
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          if (body.method === 'getBalance') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: 0 } }) });
          }
          if (body.method === 'getTokenAccountsByOwner') {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  result: {
                    value: [
                      {
                        account: {
                          data: {
                            parsed: { info: { mint: spamMint, tokenAmount: { uiAmount: 1, decimals: 0 } } },
                          },
                        },
                      },
                    ],
                  },
                }),
            });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );

      const tokensRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/tokens`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(tokensRes.status).toBe(200);
      expect(tokensRes.body.data.tokens).toHaveLength(0);
    });

    it('does not spam-filter SPL tokens when CoinGecko pricing is unavailable (native SOL itself unpriced)', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Phantom', platform: 'phantom', address: 'SomeSolAddr', chain: 'solana' });
      const walletId = createRes.body.data.id as string;
      const mint = 'SomeMintAddress11111111111111111111111111';

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, options?: { body?: string }) => {
          const urlStr = String(url);
          if (urlStr.includes('/coins/list')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                  { id: 'solana', symbol: 'sol', name: 'Solana' },
                ]),
            });
          }
          // CoinGecko rate-limited / unreachable: markets + token_price both come back empty,
          // including for SOL itself — this is the canary the spam filter checks before trusting
          // "no price" as a spam signal (see crypto.service.ts getSolanaTokens).
          if (urlStr.includes('/coins/markets')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          }
          if (urlStr.includes('/simple/token_price/')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
          }
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          if (body.method === 'getBalance') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ result: { value: 2_000_000_000 } }), // 2 SOL
            });
          }
          if (body.method === 'getTokenAccountsByOwner') {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  result: {
                    value: [
                      {
                        account: {
                          data: { parsed: { info: { mint, tokenAmount: { uiAmount: 5, decimals: 6 } } } },
                        },
                      },
                    ],
                  },
                }),
            });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );

      const tokensRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/tokens`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(tokensRes.status).toBe(200);
      // Native SOL + the SPL token both kept, unfiltered, even though neither has a price —
      // pricing being globally unavailable must not be mistaken for "these are spam".
      expect(tokensRes.body.data.tokens).toHaveLength(2);
      expect(tokensRes.body.data.tokens.map((t: { symbol: string }) => t.symbol)).toContain('SOL');
    });

    it('refuses to overwrite the stored total when CoinGecko pricing collapses for every token', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Phantom', platform: 'phantom', address: 'SomeSolAddr', chain: 'solana' });
      const walletId = createRes.body.data.id as string;

      const coinsList = () =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
              { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
              { id: 'solana', symbol: 'sol', name: 'Solana' },
            ]),
        });

      // First sync: CoinGecko is healthy, 2 SOL priced at $100 → a good snapshot gets stored.
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, options?: { body?: string }) => {
          const urlStr = String(url);
          if (urlStr.includes('/coins/list')) return coinsList();
          if (urlStr.includes('/coins/markets')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'solana', symbol: 'sol', name: 'Solana', image: 'sol.png', current_price: 100, price_change_percentage_24h: 1 },
                ]),
            });
          }
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          if (body.method === 'getBalance') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: 2_000_000_000 } }) });
          }
          if (body.method === 'getTokenAccountsByOwner') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: [] } }) });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );
      const firstSync = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(firstSync.status).toBe(200);
      expect(firstSync.body.data.totalValueUsd).toBe(20000);

      // Second sync: CoinGecko rate-limited — /coins/markets returns nothing, so SOL (the only
      // holding) resolves with no price at all. Must refuse to write rather than storing 0.
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, options?: { body?: string }) => {
          const urlStr = String(url);
          if (urlStr.includes('/coins/list')) return coinsList();
          if (urlStr.includes('/coins/markets')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          if (body.method === 'getBalance') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: 2_000_000_000 } }) });
          }
          if (body.method === 'getTokenAccountsByOwner') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: [] } }) });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );
      const secondSync = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(secondSync.status).toBe(503);
      expect(secondSync.body.error.code).toBe('COINGECKO_RATE_LIMITED');
      expect(secondSync.body.error.message).toMatch(/CoinGecko/);

      // The good snapshot from the first sync must still be the only one on record — not
      // overwritten with a corrupted ~0 total.
      const historyRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/history`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(historyRes.body.data).toHaveLength(1);
      expect(historyRes.body.data[0].totalValueUsd).toBe(20000);
    });

    it('falls back to the last synced snapshot for "Tokens détenus" when CoinGecko pricing collapses', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Phantom', platform: 'phantom', address: 'SomeSolAddr', chain: 'solana' });
      const walletId = createRes.body.data.id as string;

      const coinsList = () =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
              { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
              { id: 'solana', symbol: 'sol', name: 'Solana' },
            ]),
        });

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, options?: { body?: string }) => {
          const urlStr = String(url);
          if (urlStr.includes('/coins/list')) return coinsList();
          if (urlStr.includes('/coins/markets')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'solana', symbol: 'sol', name: 'Solana', image: 'sol.png', current_price: 100, price_change_percentage_24h: 1 },
                ]),
            });
          }
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          if (body.method === 'getBalance') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: 2_000_000_000 } }) });
          }
          if (body.method === 'getTokenAccountsByOwner') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: [] } }) });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );
      await agent.post(`/api/v1/crypto/wallets/${walletId}/sync`).set('Authorization', `Bearer ${accessToken}`);

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, options?: { body?: string }) => {
          const urlStr = String(url);
          if (urlStr.includes('/coins/list')) return coinsList();
          if (urlStr.includes('/coins/markets')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          if (body.method === 'getBalance') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: 2_000_000_000 } }) });
          }
          if (body.method === 'getTokenAccountsByOwner') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: [] } }) });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );
      const tokensRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/tokens`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(tokensRes.status).toBe(200);
      // The live SOL price failed to resolve, but the last synced snapshot had a real price —
      // that's what should come back, not a blank/priceless row.
      expect(tokensRes.body.data.tokens).toHaveLength(1);
      expect(tokensRes.body.data.tokens[0].symbol).toBe('SOL');
      expect(tokensRes.body.data.tokens[0].priceUsd).toBe(100);
      expect(tokensRes.body.data.note).toMatch(/CoinGecko/);
    });

    it('syncs a MetaMask/Ethereum wallet via Etherscan (native ETH only) and stores a snapshot', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'MetaMask', platform: 'metamask', address: '0xSomeAddr', chain: 'ethereum' });
      const walletId = createRes.body.data.id as string;

      await agent
        .put('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ etherscanApiKey: 'test-etherscan-key' });

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('action=balance')) {
            return Promise.resolve({
              ok: true,
              // 2 ETH
              json: () =>
                Promise.resolve({ status: '1', message: 'OK', result: '2000000000000000000' }),
            });
          }
          if (urlStr.includes('action=tokentx')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ status: '0', message: 'No transactions found', result: [] }),
            });
          }
          if (urlStr.includes('/coins/list')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                  { id: 'solana', symbol: 'sol', name: 'Solana' },
                ]),
            });
          }
          if (urlStr.includes('/coins/markets')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', image: 'eth.png', current_price: 3000, price_change_percentage_24h: 1 },
                ]),
            });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );

      const syncRes = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(syncRes.status).toBe(200);
      // 2 ETH * $3000 = $6000 = 600000 cents
      expect(syncRes.body.data.totalValueUsd).toBe(600000);
    });

    it('aggregates BNB Chain holdings alongside Ethereum mainnet for a MetaMask wallet', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'MetaMask', platform: 'metamask', address: '0xSomeAddr', chain: 'ethereum' });
      const walletId = createRes.body.data.id as string;

      await agent
        .put('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ etherscanApiKey: 'test-etherscan-key' });

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string | URL) => {
          const urlStr = String(url);
          // Etherscan V2 is a single unified endpoint — chainid is the only thing that
          // distinguishes an Ethereum mainnet request from a BNB Chain one.
          if (urlStr.includes('action=balance')) {
            const wei = urlStr.includes('chainid=56') ? '1000000000000000000' : '2000000000000000000'; // 1 BNB / 2 ETH
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: '1', message: 'OK', result: wei }) });
          }
          if (urlStr.includes('action=tokentx')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ status: '0', message: 'No transactions found', result: [] }),
            });
          }
          if (urlStr.includes('/coins/list')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                  { id: 'binancecoin', symbol: 'bnb', name: 'BNB' },
                ]),
            });
          }
          if (urlStr.includes('/coins/markets')) {
            const ids = new URL(urlStr).searchParams.get('ids');
            const entries =
              ids === 'binancecoin'
                ? [{ id: 'binancecoin', symbol: 'bnb', name: 'BNB', image: 'bnb.png', current_price: 500, price_change_percentage_24h: 1 }]
                : [{ id: 'ethereum', symbol: 'eth', name: 'Ethereum', image: 'eth.png', current_price: 3000, price_change_percentage_24h: 1 }];
            return Promise.resolve({ ok: true, json: () => Promise.resolve(entries) });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );

      const syncRes = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(syncRes.status).toBe(200);
      // (2 ETH * $3000) + (1 BNB * $500) = $6500 = 650000 cents
      expect(syncRes.body.data.totalValueUsd).toBe(650000);

      const tokensRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/tokens`)
        .set('Authorization', `Bearer ${accessToken}`);
      const symbols = tokensRes.body.data.tokens.map((t: { symbol: string }) => t.symbol);
      expect(symbols).toContain('ETH');
      expect(symbols).toContain('BNB');
    });

    it('does not surface a failure note when BNB Chain is rejected by the Etherscan plan (free tier)', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'MetaMask', platform: 'metamask', address: '0xSomeAddr', chain: 'ethereum' });
      const walletId = createRes.body.data.id as string;

      await agent
        .put('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ etherscanApiKey: 'test-etherscan-key' });

      // Verified live against a real free-tier Etherscan key: every non-mainnet chainid request
      // (balance and tokentx alike) comes back with this exact response, permanently — not a
      // transient rate limit.
      const unsupportedChainResponse = {
        status: '0',
        message: 'NOTOK',
        result: 'Free API access is not supported for this chain. Please upgrade your api plan for full chain coverage. https://etherscan.io/apis',
      };

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('chainid=56')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(unsupportedChainResponse) });
          }
          if (urlStr.includes('action=balance')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({ status: '1', message: 'OK', result: '2000000000000000000' }), // 2 ETH
            });
          }
          if (urlStr.includes('action=tokentx')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ status: '0', message: 'No transactions found', result: [] }),
            });
          }
          if (urlStr.includes('/coins/list')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve([{ id: 'ethereum', symbol: 'eth', name: 'Ethereum' }]),
            });
          }
          if (urlStr.includes('/coins/markets')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', image: 'eth.png', current_price: 3000, price_change_percentage_24h: 1 },
                ]),
            });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );

      const tokensRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/tokens`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(tokensRes.status).toBe(200);
      expect(tokensRes.body.data.note).toBeNull();
      expect(tokensRes.body.data.tokens.map((t: { symbol: string }) => t.symbol)).toEqual(['ETH']);
    });

    it("includes the native SOL balance in a Phantom wallet's token list even with no SPL tokens", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Phantom', platform: 'phantom', address: 'SomeSolAddr', chain: 'solana' });
      const walletId = createRes.body.data.id as string;

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, options?: { body?: string }) => {
          const urlStr = String(url);
          // CoinGecko's coin list is cached process-wide for 24h (see coingecko.client.ts) —
          // returning a full list here (rather than just 'sol') avoids poisoning that shared
          // cache for later tests in this file that need to resolve other symbols (e.g. 'btc').
          if (urlStr.includes('coingecko')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                  { id: 'solana', symbol: 'sol', name: 'Solana' },
                ]),
            });
          }
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          if (body.method === 'getBalance') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ result: { value: 2_000_000_000 } }), // 2 SOL
            });
          }
          if (body.method === 'getTokenAccountsByOwner') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { value: [] } }) });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );

      const tokensRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/tokens`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(tokensRes.status).toBe(200);
      expect(tokensRes.body.data.tokens).toHaveLength(1);
      expect(tokensRes.body.data.tokens[0]).toMatchObject({ symbol: 'SOL', amount: 2 });
    });

    it("includes the native ETH balance in a MetaMask wallet's token list even with no ERC20 tokens", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'MetaMask', platform: 'metamask', address: '0xSomeAddr', chain: 'ethereum' });
      const walletId = createRes.body.data.id as string;

      await agent
        .put('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ etherscanApiKey: 'test-etherscan-key' });

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string | URL) => {
          const urlStr = String(url);
          // MetaMask now also queries BNB Chain (chainid=56) alongside Ethereum mainnet
          // (chainid=1) — this wallet holds nothing there, so chainid=56 gets a zero balance.
          if (urlStr.includes('action=balance')) {
            const isMainnet = urlStr.includes('chainid=1');
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  status: '1',
                  message: 'OK',
                  result: isMainnet ? '2000000000000000000' : '0', // 2 ETH on mainnet, nothing on BNB Chain
                }),
            });
          }
          if (urlStr.includes('action=tokentx')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ status: '0', message: 'No transactions found', result: [] }),
            });
          }
          // Same shared-cache reasoning as the Phantom test above — full list, not just 'eth'.
          if (urlStr.includes('coingecko')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                  { id: 'solana', symbol: 'sol', name: 'Solana' },
                ]),
            });
          }
          return Promise.reject(new Error(`unexpected request to ${urlStr}`));
        }),
      );

      const tokensRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/tokens`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(tokensRes.status).toBe(200);
      expect(tokensRes.body.data.tokens).toHaveLength(1);
      expect(tokensRes.body.data.tokens[0]).toMatchObject({ symbol: 'ETH', amount: 2 });
    });

    it('returns 501 for a Crypto.com wallet since it is not configured', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Crypto.com',
          platform: 'crypto_com',
          address: 'account-1',
          chain: 'ethereum',
        });
      const walletId = createRes.body.data.id as string;

      const res = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe('CRYPTO_COM_NOT_CONFIGURED');
    });

    it('syncs a Crypto.com wallet via private/user-balance once its API keys are configured', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      await agent
        .put('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ cryptoComApiKey: 'key', cryptoComApiSecret: 'secret' });

      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Crypto.com', platform: 'crypto_com', address: 'main', chain: 'ethereum' });
      const walletId = createRes.body.data.id as string;

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('private/user-balance')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  code: 0,
                  result: {
                    data: [
                      {
                        instrument_name: 'USD',
                        total_cash_balance: '150.5',
                        total_available_balance: '150.5',
                        position_balances: [],
                      },
                    ],
                  },
                }),
            });
          }
          return Promise.reject(new Error(`unexpected URL ${urlStr}`));
        }),
      );

      const res = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalValueUsd).toBe(15050);
    });

    it('returns 501 for Coinbase and Kraken wallets since they are not implemented', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      for (const platform of ['coinbase', 'kraken'] as const) {
        const createRes = await agent
          .post('/api/v1/crypto/wallets')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: platform, platform, address: 'account-1', chain: 'ethereum' });
        const walletId = createRes.body.data.id as string;

        const res = await agent
          .post(`/api/v1/crypto/wallets/${walletId}/sync`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(501);
        expect(res.body.error.code).toBe(`${platform.toUpperCase()}_NOT_CONFIGURED`);
      }
    });

    it('syncs a Binance wallet once its API keys are configured', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      await agent
        .put('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ binanceApiKey: 'key', binanceApiSecret: 'secret' });

      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Binance', platform: 'binance', address: 'main', chain: 'ethereum' });
      const walletId = createRes.body.data.id as string;

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('/api/v3/account')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  balances: [
                    { asset: 'BTC', free: '0.5', locked: '0' },
                    { asset: 'USDT', free: '100', locked: '0' },
                  ],
                }),
            });
          }
          if (urlStr.includes('/api/v3/ticker/price')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ price: '50000' }) });
          }
          return Promise.reject(new Error(`unexpected URL ${urlStr}`));
        }),
      );

      const res = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      // 0.5 BTC * $50000 + 100 USDT * $1 = $25100 = 2,510,000 cents
      expect(res.body.data.totalValueUsd).toBe(2_510_000);
    });

    it('syncs a Bybit wallet once its API keys are configured', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      await agent
        .put('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ bybitApiKey: 'key', bybitApiSecret: 'secret' });

      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Bybit', platform: 'bybit', address: 'main', chain: 'ethereum' });
      const walletId = createRes.body.data.id as string;

      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                retCode: 0,
                retMsg: 'OK',
                result: {
                  list: [
                    {
                      coin: [
                        { coin: 'ETH', walletBalance: '2', usdValue: '6000' },
                        { coin: 'USDC', walletBalance: '50', usdValue: '50' },
                      ],
                    },
                  ],
                },
              }),
          }),
        ),
      );

      const res = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalValueUsd).toBe(605_000);
    });

    it('syncs a Meria wallet once its API key is configured, pricing via CoinGecko', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      await agent
        .put('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ meriaApiKey: 'key' });

      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Meria', platform: 'meria', address: 'main', chain: 'ethereum' });
      const walletId = createRes.body.data.id as string;

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('api.meria.com/v1/wallets')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({ success: true, data: [{ currencyCode: 'BTC', balance: 0.1 }] }),
            });
          }
          if (urlStr.includes('coingecko.com/api/v3/coins/list')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
                  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
                  { id: 'solana', symbol: 'sol', name: 'Solana' },
                ]),
            });
          }
          if (urlStr.includes('coingecko.com/api/v3/coins/markets')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  {
                    id: 'bitcoin',
                    symbol: 'btc',
                    name: 'Bitcoin',
                    image: 'https://coingecko.com/bitcoin.png',
                    current_price: 50000,
                    price_change_percentage_24h: 2.5,
                  },
                ]),
            });
          }
          return Promise.reject(new Error(`unexpected URL ${urlStr}`));
        }),
      );

      const res = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      // 0.1 BTC * $50000 = $5000 = 500,000 cents
      expect(res.body.data.totalValueUsd).toBe(500_000);

      const tokensRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/tokens`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(tokensRes.status).toBe(200);
      expect(tokensRes.body.data.tokens).toHaveLength(1);
      expect(tokensRes.body.data.tokens[0]).toMatchObject({
        symbol: 'BTC',
        name: 'Bitcoin',
        logoUrl: 'https://coingecko.com/bitcoin.png',
        change24hPct: 2.5,
      });
    });

    it('returns 501 for a Meria wallet since it is not configured', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Meria', platform: 'meria', address: 'account-1', chain: 'ethereum' });
      const walletId = createRes.body.data.id as string;

      const res = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe('MERIA_NOT_CONFIGURED');
    });
  });

  describe('cost entries (P&L tracking)', () => {
    async function createWallet(agent: ReturnType<typeof request.agent>, accessToken: string) {
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Phantom', platform: 'phantom', address: 'SomeSolAddr', chain: 'solana' });
      return createRes.body.data.id as string;
    }

    it('creates, lists, updates and deletes a cost entry', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const walletId = await createWallet(agent, accessToken);

      const createRes = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/cost-entries`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ symbol: 'SOL', amountInvestedCents: 10000, purchasedAt: '2025-01-01T00:00:00Z' });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.symbol).toBe('SOL');
      const entryId = createRes.body.data.id as string;

      const listRes = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/cost-entries`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);

      const patchRes = await agent
        .patch(`/api/v1/crypto/wallets/${walletId}/cost-entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amountInvestedCents: 15000 });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.amountInvestedCents).toBe(15000);

      const deleteRes = await agent
        .delete(`/api/v1/crypto/wallets/${walletId}/cost-entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent
        .get(`/api/v1/crypto/wallets/${walletId}/cost-entries`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterDelete.body.data).toHaveLength(0);
    });

    it("rejects update/delete of another user's cost entry", async () => {
      const { agent, accessToken } = await registerAndGetToken();

      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other-cost@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignWallet] = await db
        .insert(schema.cryptoWallets)
        .values({ userId: otherUser!.id, name: 'Not yours', platform: 'phantom', address: 'x', chain: 'solana' })
        .returning();
      const [foreignEntry] = await db
        .insert(schema.cryptoCostEntries)
        .values({ walletId: foreignWallet!.id, symbol: 'SOL', amountInvestedCents: 10000 })
        .returning();

      const patchRes = await agent
        .patch(`/api/v1/crypto/wallets/${foreignWallet!.id}/cost-entries/${foreignEntry!.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amountInvestedCents: 1 });
      expect(patchRes.status).toBe(404);

      const deleteRes = await agent
        .delete(`/api/v1/crypto/wallets/${foreignWallet!.id}/cost-entries/${foreignEntry!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(404);
    });
  });
});
