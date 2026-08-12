import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/config/database.js';
import * as schema from '../src/db/schema/index.js';

const app = createApp();

// stock_quotes is a global (non-user-scoped) cache table — not covered by tests/setup.ts's
// users/refresh_tokens truncate — so it must be cleared here to keep the quote tests isolated
// from previous runs (same pitfall documented for the TCGdex cache in collectibles tests).
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE stock_quotes`);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('investments module', () => {
  describe('CRUD', () => {
    it('creates, gets, updates and deletes an investment account', async () => {
      const { agent, accessToken } = await registerAndGetToken();

      const createRes = await agent
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA', platform: 'Trade Republic', currentValue: 500000 });
      expect(createRes.status).toBe(201);
      const accountId = createRes.body.data.id as string;

      const getRes = await agent
        .get(`/api/v1/investments/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe('PEA');

      const patchRes = await agent
        .patch(`/api/v1/investments/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA principal' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.name).toBe('PEA principal');

      const deleteRes = await agent
        .delete(`/api/v1/investments/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent
        .get(`/api/v1/investments/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterDelete.status).toBe(404);
    });

    it("rejects access to another user's investment account", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignAccount] = await db
        .insert(schema.investmentAccounts)
        .values({ userId: otherUser!.id, name: 'Not yours', currentValue: 0 })
        .returning();

      const res = await agent
        .get(`/api/v1/investments/${foreignAccount!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /:id/entry', () => {
    it('records a DCA entry and updates the account current value', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA', currentValue: 100000 });
      const accountId = createRes.body.data.id as string;

      const entryRes = await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2026-01-15', amountInvested: 20000, portfolioValue: 130000 });

      expect(entryRes.status).toBe(201);
      expect(entryRes.body.data.entry.portfolioValue).toBe(130000);

      const getRes = await agent
        .get(`/api/v1/investments/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.body.data.currentValue).toBe(130000);
    });

    it('creates a milestone once the total across all accounts crosses a threshold', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      await db
        .insert(schema.investmentAccounts)
        .values({ userId, name: 'A', currentValue: 1_900_000 });
      const [accountB] = await db
        .insert(schema.investmentAccounts)
        .values({ userId, name: 'B', currentValue: 50_000 })
        .returning();

      // A (1.9M) + B (50K) = 1.95M, still under the 2M (20K€) milestone.
      const belowRes = await agent
        .post(`/api/v1/investments/${accountB!.id}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2026-01-01', amountInvested: 0, portfolioValue: 50_000 });
      expect(belowRes.body.data.reachedMilestones).toHaveLength(0);

      // Pushing B up to 150K makes the total 2.05M, crossing the 2M milestone.
      const crossRes = await agent
        .post(`/api/v1/investments/${accountB!.id}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2026-01-02', amountInvested: 0, portfolioValue: 150_000 });
      expect(crossRes.body.data.reachedMilestones).toHaveLength(1);
      expect(crossRes.body.data.reachedMilestones[0]).toMatchObject({ amount: 2_000_000 });

      const milestonesRes = await agent
        .get('/api/v1/investments/milestones')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(milestonesRes.body.data.reached).toHaveLength(1);
      expect(milestonesRes.body.data.currentTotal).toBe(2_050_000);
      const next5M = milestonesRes.body.data.next.find(
        (m: { amount: number }) => m.amount === 5_000_000,
      );
      expect(next5M.progress).toBeCloseTo(2_050_000 / 5_000_000);
    });

    it('stores the asset type, ISIN and share count when provided', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA', currentValue: 0 });
      const accountId = createRes.body.data.id as string;

      const entryRes = await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          date: '2026-01-15',
          amountInvested: 20000,
          portfolioValue: 20000,
          ticker: 'IWDA.AS',
          assetType: 'etf',
          isin: 'IE00B4L5Y983',
          shares: 12.5,
        });

      expect(entryRes.status).toBe(201);
      expect(entryRes.body.data.entry).toMatchObject({
        assetType: 'etf',
        isin: 'IE00B4L5Y983',
        shares: 12.5,
      });

      const listRes = await agent
        .get(`/api/v1/investments/${accountId}/entries`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(listRes.body.data[0]).toMatchObject({
        assetType: 'etf',
        isin: 'IE00B4L5Y983',
        shares: 12.5,
      });
    });

    it('leaves asset type, ISIN and shares null when not provided', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA', currentValue: 0 });
      const accountId = createRes.body.data.id as string;

      const entryRes = await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2026-01-15', amountInvested: 20000, portfolioValue: 20000 });

      expect(entryRes.status).toBe(201);
      expect(entryRes.body.data.entry).toMatchObject({ assetType: null, isin: null, shares: null });
    });

    it('defaults entryType to contribution, and accepts dividend', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA', currentValue: 0 });
      const accountId = createRes.body.data.id as string;

      const defaultRes = await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2026-01-01', amountInvested: 10000, portfolioValue: 10000 });
      expect(defaultRes.body.data.entry.entryType).toBe('contribution');

      const dividendRes = await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          date: '2026-01-02',
          amountInvested: 500,
          portfolioValue: 10500,
          entryType: 'dividend',
          ticker: 'CS.PA',
        });
      expect(dividendRes.body.data.entry.entryType).toBe('dividend');

      const feeRes = await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          date: '2026-01-03',
          amountInvested: 300,
          portfolioValue: 10200,
          entryType: 'fee',
        });
      expect(feeRes.body.data.entry.entryType).toBe('fee');
    });
  });

  describe('PATCH/DELETE /:id/entry/:entryId', () => {
    it('updates an entry and recomputes the account current value from the latest date', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA', currentValue: 0 });
      const accountId = createRes.body.data.id as string;

      const entryRes = await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2026-01-01', amountInvested: 10000, portfolioValue: 10000 });
      const entryId = entryRes.body.data.entry.id as string;

      const patchRes = await agent
        .patch(`/api/v1/investments/${accountId}/entry/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ portfolioValue: 15000 });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.portfolioValue).toBe(15000);

      const getRes = await agent
        .get(`/api/v1/investments/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.body.data.currentValue).toBe(15000);
    });

    it('deletes an entry and recomputes the account current value to the remaining latest entry', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA', currentValue: 0 });
      const accountId = createRes.body.data.id as string;

      const firstRes = await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2026-01-01', amountInvested: 10000, portfolioValue: 10000 });
      const secondRes = await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2026-02-01', amountInvested: 10000, portfolioValue: 25000 });
      const secondEntryId = secondRes.body.data.entry.id as string;

      const deleteRes = await agent
        .delete(`/api/v1/investments/${accountId}/entry/${secondEntryId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const getRes = await agent
        .get(`/api/v1/investments/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.body.data.currentValue).toBe(10000);

      const listRes = await agent
        .get(`/api/v1/investments/${accountId}/entries`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].id).toBe(firstRes.body.data.entry.id);
    });

    it('resets current value to 0 once the last entry is deleted', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA', currentValue: 0 });
      const accountId = createRes.body.data.id as string;

      const entryRes = await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2026-01-01', amountInvested: 10000, portfolioValue: 10000 });
      const entryId = entryRes.body.data.entry.id as string;

      await agent
        .delete(`/api/v1/investments/${accountId}/entry/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      const getRes = await agent
        .get(`/api/v1/investments/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.body.data.currentValue).toBe(0);
    });

    it("rejects editing/deleting another user's investment entry", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other-entry-edit@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignAccount] = await db
        .insert(schema.investmentAccounts)
        .values({ userId: otherUser!.id, name: 'Foreign' })
        .returning();
      const [foreignEntry] = await db
        .insert(schema.investmentEntries)
        .values({
          investmentAccountId: foreignAccount!.id,
          date: new Date('2026-01-01'),
          amountInvested: 1000,
          portfolioValue: 1000,
        })
        .returning();

      const patchRes = await agent
        .patch(`/api/v1/investments/${foreignAccount!.id}/entry/${foreignEntry!.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ portfolioValue: 5000 });
      expect(patchRes.status).toBe(404);

      const deleteRes = await agent
        .delete(`/api/v1/investments/${foreignAccount!.id}/entry/${foreignEntry!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(404);
    });
  });

  describe('GET /:id/entries', () => {
    it('lists entries sorted by date', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA', currentValue: 0 });
      const accountId = createRes.body.data.id as string;

      await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2026-02-01', amountInvested: 10_000, portfolioValue: 60_000 });
      await agent
        .post(`/api/v1/investments/${accountId}/entry`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2026-01-01', amountInvested: 50_000, portfolioValue: 50_000 });

      const res = await agent
        .get(`/api/v1/investments/${accountId}/entries`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toMatchObject({ portfolioValue: 50_000 });
      expect(res.body.data[1]).toMatchObject({ portfolioValue: 60_000 });
    });

    it("rejects access to another user's investment account entries", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other-entries@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignAccount] = await db
        .insert(schema.investmentAccounts)
        .values({ userId: otherUser!.id, name: 'Not yours', currentValue: 0 })
        .returning();

      const res = await agent
        .get(`/api/v1/investments/${foreignAccount!.id}/entries`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /:id/projection', () => {
    it('projects a zero-rate DCA linearly and finds the milestone crossing month', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA', currentValue: 1_900_000 });
      const accountId = createRes.body.data.id as string;

      const res = await agent
        .get(`/api/v1/investments/${accountId}/projection`)
        .query({ monthlyContribution: 50_000, annualRate: 0, years: 1 })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.points).toHaveLength(12);
      expect(res.body.data.points[0]).toMatchObject({ month: 1, value: 1_950_000 });
      expect(res.body.data.points[11]).toMatchObject({ month: 12, value: 2_500_000 });

      const twentyK = res.body.data.milestones.find(
        (m: { amount: number }) => m.amount === 2_000_000,
      );
      expect(twentyK.reached).toBe(false);
      expect(twentyK.estimatedDate).toBe(res.body.data.points[1].date);

      const fiftyK = res.body.data.milestones.find(
        (m: { amount: number }) => m.amount === 5_000_000,
      );
      expect(fiftyK.estimatedDate).toBeNull();
    });

    it('applies compound growth when annualRate is set', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/investments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PEA', currentValue: 100_000 });
      const accountId = createRes.body.data.id as string;

      const res = await agent
        .get(`/api/v1/investments/${accountId}/projection`)
        .query({ monthlyContribution: 0, annualRate: 0.12, years: 1 })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const expected = Math.round(100_000 * Math.pow(1 + 0.12 / 12, 12));
      expect(res.body.data.points[11].value).toBe(expected);
    });
  });

  describe('goals', () => {
    it('creates, lists, updates and deletes a goal', async () => {
      const { agent, accessToken } = await registerAndGetToken();

      const createRes = await agent
        .post('/api/v1/investments/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Indépendance financière', targetAmount: 50_000_000 });
      expect(createRes.status).toBe(201);
      const goalId = createRes.body.data.id as string;
      expect(createRes.body.data.name).toBe('Indépendance financière');

      const listRes = await agent
        .get('/api/v1/investments/goals')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].id).toBe(goalId);

      const patchRes = await agent
        .patch(`/api/v1/investments/goals/${goalId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'FIRE', targetAmount: 60_000_000 });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.name).toBe('FIRE');
      expect(patchRes.body.data.targetAmount).toBe(60_000_000);

      const deleteRes = await agent
        .delete(`/api/v1/investments/goals/${goalId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent
        .get('/api/v1/investments/goals')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterDelete.body.data).toHaveLength(0);
    });

    it("rejects updating or deleting another user's goal", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignGoal] = await db
        .insert(schema.investmentGoals)
        .values({ userId: otherUser!.id, name: 'Not yours', targetAmount: 1000 })
        .returning();

      const patchRes = await agent
        .patch(`/api/v1/investments/goals/${foreignGoal!.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Hijacked' });
      expect(patchRes.status).toBe(404);

      const deleteRes = await agent
        .delete(`/api/v1/investments/goals/${foreignGoal!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(404);
    });
  });

  describe('GET /quote', () => {
    it('returns 501 when Alpha Vantage is not configured', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .get('/api/v1/investments/quote')
        .query({ symbol: 'NOCONFIG.TEST' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe('ALPHA_VANTAGE_NOT_CONFIGURED');
    });

    it('fetches live once then serves the cached quote for the rest of the day', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      await agent
        .put('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ alphaVantageApiKey: 'test-key' });

      const fetchMock = vi.fn((url: string | URL) =>
        Promise.resolve({
          ok: true,
          json: () =>
            url.toString().includes('SYMBOL_SEARCH')
              ? Promise.resolve({ bestMatches: [{ '1. symbol': 'IWDA.AS', '8. currency': 'EUR' }] })
              : Promise.resolve({
                  'Global Quote': {
                    '01. symbol': 'IWDA.AS',
                    '05. price': '92.10',
                    '10. change percent': '0.55%',
                  },
                }),
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const first = await agent
        .get('/api/v1/investments/quote')
        .query({ symbol: 'IWDA.AS' })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(first.status).toBe(200);
      expect(first.body.data.price).toBe(92.1);
      expect(first.body.data.changePercent).toBe(0.55);
      expect(first.body.data.currency).toBe('EUR');
      // GLOBAL_QUOTE + a one-time SYMBOL_SEARCH currency lookup (cached forever after).
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const second = await agent
        .get('/api/v1/investments/quote')
        .query({ symbol: 'IWDA.AS' })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(second.status).toBe(200);
      expect(second.body.data.currency).toBe('EUR');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('keeps serving the quote when the currency lookup fails, without caching a currency', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      await agent
        .put('/api/v1/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ alphaVantageApiKey: 'test-key' });

      const fetchMock = vi.fn((url: string | URL) =>
        Promise.resolve({
          ok: true,
          json: () =>
            url.toString().includes('SYMBOL_SEARCH')
              ? Promise.resolve({ bestMatches: [] })
              : Promise.resolve({
                  'Global Quote': {
                    '01. symbol': 'UNKNOWN.X',
                    '05. price': '10.00',
                    '10. change percent': '0.00%',
                  },
                }),
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const res = await agent
        .get('/api/v1/investments/quote')
        .query({ symbol: 'UNKNOWN.X' })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.price).toBe(10);
      expect(res.body.data.currency).toBeNull();
    });
  });
});
