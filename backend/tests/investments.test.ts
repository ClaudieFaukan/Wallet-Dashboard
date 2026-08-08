import { describe, expect, it } from 'vitest';
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
});
