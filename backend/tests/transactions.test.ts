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

async function createAccount(userId: string) {
  const [account] = await db
    .insert(schema.accounts)
    .values({ userId, name: 'Compte courant', type: 'checking', balance: 0 })
    .returning();
  return account!;
}

describe('transactions module', () => {
  it('rejects requests without an access token', async () => {
    const res = await request(app).get('/api/v1/transactions');
    expect(res.status).toBe(401);
  });

  describe('POST /api/v1/transactions', () => {
    it('creates a transaction on an owned account', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const account = await createAccount(userId);

      const res = await agent
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId: account.id,
          amount: -1500,
          type: 'expense',
          date: '2026-01-15T10:00:00.000Z',
          description: 'Coffee',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe(-1500);
      expect(res.body.data.description).toBe('Coffee');
    });

    it('rejects a transaction on an account owned by someone else', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const foreignAccount = await createAccount(otherUser!.id);

      const res = await agent
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId: foreignAccount.id,
          amount: -100,
          type: 'expense',
          date: '2026-01-15T10:00:00.000Z',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
    });

    it('rejects invalid input', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 'not-a-number' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/transactions', () => {
    it('filters by search and paginates with a cursor', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const account = await createAccount(userId);

      await db.insert(schema.transactions).values([
        {
          accountId: account.id,
          amount: -1000,
          type: 'expense',
          date: new Date('2026-01-01T00:00:00.000Z'),
          description: 'Groceries',
        },
        {
          accountId: account.id,
          amount: -2000,
          type: 'expense',
          date: new Date('2026-01-02T00:00:00.000Z'),
          description: 'Groceries again',
        },
        {
          accountId: account.id,
          amount: 500,
          type: 'income',
          date: new Date('2026-01-03T00:00:00.000Z'),
          description: 'Refund',
        },
      ]);

      const searchRes = await agent
        .get('/api/v1/transactions')
        .query({ search: 'groceries' })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data).toHaveLength(2);

      const page1 = await agent
        .get('/api/v1/transactions')
        .query({ limit: 2 })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(page1.status).toBe(200);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.meta.hasMore).toBe(true);
      expect(page1.body.meta.nextCursor).toBeTruthy();

      const page2 = await agent
        .get('/api/v1/transactions')
        .query({ limit: 2, cursor: page1.body.meta.nextCursor })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(page2.status).toBe(200);
      expect(page2.body.data).toHaveLength(1);
      expect(page2.body.meta.hasMore).toBe(false);
    });
  });

  describe('GET/PATCH/DELETE /api/v1/transactions/:id', () => {
    it('gets, updates and deletes a transaction, and 404s afterwards', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const account = await createAccount(userId);
      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          accountId: account.id,
          amount: -100,
          type: 'expense',
          date: new Date('2026-01-01T00:00:00.000Z'),
          description: 'Original',
        })
        .returning();

      const getRes = await agent
        .get(`/api/v1/transactions/${transaction!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.status).toBe(200);

      const patchRes = await agent
        .patch(`/api/v1/transactions/${transaction!.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ description: 'Updated' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.description).toBe('Updated');

      const deleteRes = await agent
        .delete(`/api/v1/transactions/${transaction!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent
        .get(`/api/v1/transactions/${transaction!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterDelete.status).toBe(404);
    });
  });

  describe('GET /api/v1/transactions/stats', () => {
    it('aggregates totals by category and by month', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const account = await createAccount(userId);
      const [category] = await db
        .insert(schema.categories)
        .values({ userId, name: 'Food', type: 'expense' })
        .returning();

      await db.insert(schema.transactions).values([
        {
          accountId: account.id,
          amount: -1000,
          type: 'expense',
          categoryId: category!.id,
          date: new Date('2026-01-05T00:00:00.000Z'),
        },
        {
          accountId: account.id,
          amount: -500,
          type: 'expense',
          categoryId: category!.id,
          date: new Date('2026-02-05T00:00:00.000Z'),
        },
        {
          accountId: account.id,
          amount: 3000,
          type: 'income',
          date: new Date('2026-01-10T00:00:00.000Z'),
        },
      ]);

      const res = await agent
        .get('/api/v1/transactions/stats')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const foodCategory = res.body.data.byCategory.find(
        (c: { categoryId: string }) => c.categoryId === category!.id,
      );
      expect(foodCategory.total).toBe(-1500);

      const january = res.body.data.byMonth.find((m: { month: string }) => m.month === '2026-01');
      expect(january.totalIncome).toBe(3000);
      expect(january.totalExpense).toBe(-1000);
    });
  });
});
