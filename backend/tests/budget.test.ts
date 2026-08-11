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

function monthString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

describe('budget module', () => {
  describe('GET /api/v1/budget/current', () => {
    it('auto-creates an empty period on first access', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .get('/api/v1/budget/current')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalPlanned).toBe(0);
      expect(res.body.data.lines).toEqual([]);
    });

    it('copies budget lines from the previous month', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [category] = await db
        .insert(schema.categories)
        .values({ userId, name: 'Food', type: 'expense' })
        .returning();

      const previousMonth = new Date();
      previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
      const [previousPeriod] = await db
        .insert(schema.budgetPeriods)
        .values({ userId, month: monthString(previousMonth), totalPlanned: 5000 })
        .returning();
      await db.insert(schema.budgetLines).values({
        budgetPeriodId: previousPeriod!.id,
        categoryId: category!.id,
        plannedAmount: 5000,
      });

      const res = await agent
        .get('/api/v1/budget/current')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalPlanned).toBe(5000);
      expect(res.body.data.lines).toHaveLength(1);
      expect(res.body.data.lines[0]).toMatchObject({
        categoryId: category!.id,
        plannedAmount: 5000,
      });
    });

    it("computes actualAmount dynamically from this month's transactions", async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [category] = await db
        .insert(schema.categories)
        .values({ userId, name: 'Food', type: 'expense' })
        .returning();
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId, name: 'Compte', type: 'checking', balance: 0 })
        .returning();

      await agent
        .post('/api/v1/budget/lines')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ categoryId: category!.id, plannedAmount: 10000 });

      await db.insert(schema.transactions).values({
        accountId: account!.id,
        amount: -3000,
        type: 'expense',
        categoryId: category!.id,
        date: new Date(),
      });

      const res = await agent
        .get('/api/v1/budget/current')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalActual).toBe(3000);
      expect(res.body.data.lines[0]).toMatchObject({ plannedAmount: 10000, actualAmount: 3000 });
    });

    it('returns per-day totals for the cumulative spend chart', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [category] = await db
        .insert(schema.categories)
        .values({ userId, name: 'Food', type: 'expense' })
        .returning();
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId, name: 'Compte', type: 'checking', balance: 0 })
        .returning();

      const today = new Date();
      const day5 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 5, 12));
      await db.insert(schema.transactions).values([
        { accountId: account!.id, amount: -1000, type: 'expense', categoryId: category!.id, date: day5 },
        { accountId: account!.id, amount: -500, type: 'expense', categoryId: category!.id, date: day5 },
      ]);

      const res = await agent
        .get('/api/v1/budget/current')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.dailySpend).toEqual([{ day: 5, amount: 1500 }]);
    });

    it('ignores income transactions when computing actualAmount', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [category] = await db
        .insert(schema.categories)
        .values({ userId, name: 'Salaire', type: 'income' })
        .returning();
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId, name: 'Compte', type: 'checking', balance: 0 })
        .returning();

      await db.insert(schema.transactions).values({
        accountId: account!.id,
        amount: 250000,
        type: 'income',
        categoryId: category!.id,
        date: new Date(),
      });

      const res = await agent
        .get('/api/v1/budget/current')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalActual).toBe(0);
    });
  });

  describe('PATCH /api/v1/budget/lines/:id', () => {
    it('updates the planned amount and recomputes the period total', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [category] = await db
        .insert(schema.categories)
        .values({ userId, name: 'Food', type: 'expense' })
        .returning();

      const createRes = await agent
        .post('/api/v1/budget/lines')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ categoryId: category!.id, plannedAmount: 1000 });
      const lineId = createRes.body.data.id as string;

      const patchRes = await agent
        .patch(`/api/v1/budget/lines/${lineId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ plannedAmount: 2500 });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.plannedAmount).toBe(2500);

      const currentRes = await agent
        .get('/api/v1/budget/current')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(currentRes.body.data.totalPlanned).toBe(2500);
    });

    it('rejects updating a line belonging to another user', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [otherCategory] = await db
        .insert(schema.categories)
        .values({ userId: otherUser!.id, name: 'Other cat', type: 'expense' })
        .returning();
      const [otherPeriod] = await db
        .insert(schema.budgetPeriods)
        .values({ userId: otherUser!.id, month: monthString(new Date()) })
        .returning();
      const [otherLine] = await db
        .insert(schema.budgetLines)
        .values({
          budgetPeriodId: otherPeriod!.id,
          categoryId: otherCategory!.id,
          plannedAmount: 100,
        })
        .returning();

      const res = await agent
        .patch(`/api/v1/budget/lines/${otherLine!.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ plannedAmount: 999 });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/budget/lines/:id', () => {
    it('removes the line and recomputes the period total', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [category] = await db
        .insert(schema.categories)
        .values({ userId, name: 'Food', type: 'expense' })
        .returning();

      const createRes = await agent
        .post('/api/v1/budget/lines')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ categoryId: category!.id, plannedAmount: 1000 });
      const lineId = createRes.body.data.id as string;

      const deleteRes = await agent
        .delete(`/api/v1/budget/lines/${lineId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const currentRes = await agent
        .get('/api/v1/budget/current')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(currentRes.body.data.totalPlanned).toBe(0);
      expect(currentRes.body.data.lines).toEqual([]);
    });

    it('rejects deleting a line belonging to another user', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other2@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [otherCategory] = await db
        .insert(schema.categories)
        .values({ userId: otherUser!.id, name: 'Other cat', type: 'expense' })
        .returning();
      const [otherPeriod] = await db
        .insert(schema.budgetPeriods)
        .values({ userId: otherUser!.id, month: monthString(new Date()) })
        .returning();
      const [otherLine] = await db
        .insert(schema.budgetLines)
        .values({
          budgetPeriodId: otherPeriod!.id,
          categoryId: otherCategory!.id,
          plannedAmount: 100,
        })
        .returning();

      const res = await agent
        .delete(`/api/v1/budget/lines/${otherLine!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/budget/:year', () => {
    it('returns 12 months with planned/actual/variance', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId, name: 'Compte', type: 'checking', balance: 0 })
        .returning();

      const year = new Date().getUTCFullYear();
      await db
        .insert(schema.budgetPeriods)
        .values({ userId, month: `${year}-01-01`, totalPlanned: 1000 });
      await db.insert(schema.transactions).values({
        accountId: account!.id,
        amount: -700,
        type: 'expense',
        date: new Date(`${year}-01-15T00:00:00.000Z`),
      });

      const res = await agent
        .get(`/api/v1/budget/${year}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(12);
      const january = res.body.data.find((m: { month: string }) => m.month === `${year}-01`);
      expect(january).toMatchObject({ totalPlanned: 1000, totalActual: 700, variance: -300 });
      const march = res.body.data.find((m: { month: string }) => m.month === `${year}-03`);
      expect(march).toMatchObject({ totalPlanned: 0, totalActual: 0, variance: 0 });
    });
  });

  describe('GET /api/v1/budget/current?month=', () => {
    it('fetches/creates the period for an arbitrary month instead of the current one', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [category] = await db
        .insert(schema.categories)
        .values({ userId, name: 'Food', type: 'expense' })
        .returning();
      const [period] = await db
        .insert(schema.budgetPeriods)
        .values({ userId, month: '2025-03-01', totalPlanned: 4200 })
        .returning();
      await db.insert(schema.budgetLines).values({
        budgetPeriodId: period!.id,
        categoryId: category!.id,
        plannedAmount: 4200,
      });

      const res = await agent
        .get('/api/v1/budget/current?month=2025-03')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.month).toBe('2025-03-01');
      expect(res.body.data.totalPlanned).toBe(4200);
    });

    it('rejects a malformed month', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .get('/api/v1/budget/current?month=not-a-month')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/budget/lines with a month', () => {
    it('adds the line to the given month instead of the current one', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [category] = await db
        .insert(schema.categories)
        .values({ userId, name: 'Food', type: 'expense' })
        .returning();

      await agent
        .post('/api/v1/budget/lines')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ categoryId: category!.id, plannedAmount: 3000, month: '2025-06' });

      const juneRes = await agent
        .get('/api/v1/budget/current?month=2025-06')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(juneRes.body.data.lines).toHaveLength(1);
      expect(juneRes.body.data.lines[0]).toMatchObject({ plannedAmount: 3000 });

      // A month strictly before June 2025 has no earlier period to copy from,
      // so it should stay empty — confirms the line was scoped to June only.
      const earlierRes = await agent
        .get('/api/v1/budget/current?month=2025-01')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(earlierRes.body.data.lines).toEqual([]);
    });
  });
});
