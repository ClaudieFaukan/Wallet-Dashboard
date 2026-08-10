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
    it('syncs a Phantom/Solana wallet and stores a snapshot', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/crypto/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Phantom', platform: 'phantom', address: 'SomeSolAddr', chain: 'solana' });
      const walletId = createRes.body.data.id as string;

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url.includes('coingecko')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ solana: { usd: 100 } }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ result: { value: 2_000_000_000 } }), // 2 SOL
          });
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

    it('syncs a MetaMask/Ethereum wallet via Etherscan and stores a snapshot', async () => {
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
          if (String(url).includes('coingecko')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ ethereum: { usd: 3000 } }),
            });
          }
          return Promise.resolve({
            ok: true,
            // 2 ETH
            json: () =>
              Promise.resolve({ status: '1', message: 'OK', result: '2000000000000000000' }),
          });
        }),
      );

      const syncRes = await agent
        .post(`/api/v1/crypto/wallets/${walletId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(syncRes.status).toBe(200);
      // 2 ETH * $3000 = $6000 = 600000 cents
      expect(syncRes.body.data.totalValueUsd).toBe(600000);
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
  });
});
