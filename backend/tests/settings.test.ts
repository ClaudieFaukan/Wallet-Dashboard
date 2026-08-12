import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
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

describe('POST /settings/dev-reset', () => {
  it('wipes accounts/budget/savings/investments/real-estate/credits but keeps user, settings, categories, crypto and collectibles', async () => {
    const { agent, accessToken, userId } = await registerAndGetToken();

    const [account] = await db
      .insert(schema.accounts)
      .values({ userId, name: 'Compte', type: 'checking', balance: 1000 })
      .returning();
    await db.insert(schema.transactions).values({
      accountId: account!.id,
      amount: -500,
      currency: 'EUR',
      type: 'expense',
      description: 'Test',
      date: new Date(),
    });
    const [category] = await db
      .insert(schema.categories)
      .values({ userId, name: 'Alimentation', type: 'expense' })
      .returning();
    const [budgetPeriod] = await db
      .insert(schema.budgetPeriods)
      .values({ userId, month: '2026-01-01' })
      .returning();
    await db
      .insert(schema.budgetLines)
      .values({ budgetPeriodId: budgetPeriod!.id, categoryId: category!.id, plannedAmount: 10000 });
    await db
      .insert(schema.savingsGoals)
      .values({ userId, name: 'Urgence', targetAmount: 100000 });
    await db
      .insert(schema.investmentAccounts)
      .values({ userId, name: 'PEA', currentValue: 5000 });
    await db.insert(schema.realEstateAssets).values({
      userId,
      name: 'Appart',
      type: 'physical',
      purchasePrice: 100000,
      currentValue: 110000,
      purchaseDate: '2020-01-01',
    });
    await db.insert(schema.credits).values({
      userId,
      name: 'Prêt auto',
      institution: 'Banque',
      initialAmount: 10000,
      remainingAmount: 8000,
      monthlyPayment: 200,
      interestRate: 0.02,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2029-01-01'),
    });
    await db
      .insert(schema.cryptoWallets)
      .values({ userId, name: 'MetaMask', platform: 'metamask', address: '0xabc', chain: 'ethereum' });
    await db
      .insert(schema.collectibleItems)
      .values({
        userId,
        itemType: 'card',
        name: 'Pikachu',
        purchasePrice: 1000,
        purchaseDate: '2024-01-01',
      });
    await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ etherscanApiKey: 'test-key' });

    const res = await agent
      .post('/api/v1/settings/dev-reset')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(204);

    const remainingAccounts = await db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId));
    const remainingTransactions = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.accountId, account!.id));
    const remainingBudgetPeriods = await db
      .select()
      .from(schema.budgetPeriods)
      .where(eq(schema.budgetPeriods.userId, userId));
    const remainingSavingsGoals = await db
      .select()
      .from(schema.savingsGoals)
      .where(eq(schema.savingsGoals.userId, userId));
    const remainingInvestmentAccounts = await db
      .select()
      .from(schema.investmentAccounts)
      .where(eq(schema.investmentAccounts.userId, userId));
    const remainingRealEstate = await db
      .select()
      .from(schema.realEstateAssets)
      .where(eq(schema.realEstateAssets.userId, userId));
    const remainingCredits = await db
      .select()
      .from(schema.credits)
      .where(eq(schema.credits.userId, userId));
    expect(remainingAccounts).toHaveLength(0);
    expect(remainingTransactions).toHaveLength(0);
    expect(remainingBudgetPeriods).toHaveLength(0);
    expect(remainingSavingsGoals).toHaveLength(0);
    expect(remainingInvestmentAccounts).toHaveLength(0);
    expect(remainingRealEstate).toHaveLength(0);
    expect(remainingCredits).toHaveLength(0);

    const remainingUser = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    const remainingCategories = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.userId, userId));
    const remainingWallets = await db
      .select()
      .from(schema.cryptoWallets)
      .where(eq(schema.cryptoWallets.userId, userId));
    const remainingCollectibles = await db
      .select()
      .from(schema.collectibleItems)
      .where(eq(schema.collectibleItems.userId, userId));
    const remainingSettings = await db
      .select()
      .from(schema.appSettings)
      .where(and(eq(schema.appSettings.userId, userId), eq(schema.appSettings.key, 'etherscan_api_key')));
    expect(remainingUser).toHaveLength(1);
    expect(remainingCategories.map((c) => c.name)).toContain('Alimentation');
    expect(remainingWallets).toHaveLength(1);
    expect(remainingCollectibles).toHaveLength(1);
    expect(remainingSettings).toHaveLength(1);
  });

  it('is blocked for the demo account', async () => {
    const agent = request.agent(app);
    const demoRes = await agent
      .post('/api/v1/auth/login')
      .send({ email: 'demo@finance.app', password: 'demo123' });
    const accessToken = demoRes.body.data.accessToken as string;

    const res = await agent
      .post('/api/v1/settings/dev-reset')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEMO_READ_ONLY');
  });
});

describe('settings module', () => {
  it('reports everything unconfigured before any key is saved', async () => {
    const { agent, accessToken } = await registerAndGetToken();
    const res = await agent.get('/api/v1/settings').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      etherscanConfigured: false,
      cryptoComConfigured: false,
      pokemonPriceTrackerConfigured: false,
      poketraceConfigured: false,
      revolutConfigured: false,
      alphaVantageConfigured: false,
      binanceConfigured: false,
      bybitConfigured: false,
      meriaConfigured: false,
    });
  });

  it('saves a key, reports it configured, and stores it encrypted (not in plaintext)', async () => {
    const { agent, accessToken, userId } = await registerAndGetToken();

    const putRes = await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ etherscanApiKey: 'super-secret-key' });

    expect(putRes.status).toBe(200);
    expect(putRes.body.data.etherscanConfigured).toBe(true);

    const [row] = await db
      .select()
      .from(schema.appSettings)
      .where(and(eq(schema.appSettings.userId, userId), eq(schema.appSettings.key, 'etherscan_api_key')));
    expect(row).toBeDefined();
    expect(row!.valueEncrypted).not.toContain('super-secret-key');
    expect(row!.valueEncrypted.split(':')).toHaveLength(3);
  });

  it('only reports a paired key (Crypto.com) configured once both fields are set', async () => {
    const { agent, accessToken } = await registerAndGetToken();

    const partial = await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ cryptoComApiKey: 'key-only' });
    expect(partial.body.data.cryptoComConfigured).toBe(false);

    const complete = await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ cryptoComApiSecret: 'secret-too' });
    expect(complete.body.data.cryptoComConfigured).toBe(true);
  });

  it('clears a key when saved with an empty string', async () => {
    const { agent, accessToken } = await registerAndGetToken();

    await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ poketraceApiKey: 'some-key' });

    const cleared = await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ poketraceApiKey: '' });

    expect(cleared.body.data.poketraceConfigured).toBe(false);
  });

  describe('POST /settings/test', () => {
    it('reports success for a valid Etherscan key', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: '1', message: 'OK', result: '1000000000000000000' }),
          }),
        ),
      );

      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'etherscan', etherscanApiKey: 'a-key' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('reports failure for an invalid Etherscan key', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: '0', message: 'Invalid API Key', result: '' }),
          }),
        ),
      );

      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'etherscan', etherscanApiKey: 'bad-key' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(false);
    });

    it('reports success for a valid Alpha Vantage key', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                'Global Quote': { '01. symbol': 'IBM', '05. price': '123.45', '10. change percent': '1.23%' },
              }),
          }),
        ),
      );

      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'alphaVantage', alphaVantageApiKey: 'a-key' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('reports success for valid Binance keys', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ balances: [{ asset: 'BTC', free: '0.1', locked: '0' }] }),
          }),
        ),
      );

      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'binance', binanceApiKey: 'key', binanceApiSecret: 'secret' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('reports success for valid Bybit keys', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                retCode: 0,
                retMsg: 'OK',
                result: { list: [{ coin: [{ coin: 'ETH', walletBalance: '1', usdValue: '3000' }] }] },
              }),
          }),
        ),
      );

      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'bybit', bybitApiKey: 'key', bybitApiSecret: 'secret' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('reports success for a valid Meria key', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: [{ currencyCode: 'BTC', balance: 0.1 }] }),
          }),
        ),
      );

      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'meria', meriaApiKey: 'key' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('acknowledges Revolut credentials without a live network call', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'revolut', revolutClientId: 'id', revolutClientSecret: 'secret' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('rejects a test request missing required fields for its section', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'cryptoCom', cryptoComApiKey: 'key-only' });

      expect(res.status).toBe(400);
    });
  });
});
