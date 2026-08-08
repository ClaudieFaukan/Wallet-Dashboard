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

describe('accounts module', () => {
  describe('CRUD', () => {
    it('creates, lists, gets, updates and deletes an account', async () => {
      const { agent, accessToken } = await registerAndGetToken();

      const createRes = await agent
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Compte courant', type: 'checking', balance: 10000 });
      expect(createRes.status).toBe(201);
      const accountId = createRes.body.data.id as string;

      const listRes = await agent
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);

      const getRes = await agent
        .get(`/api/v1/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe('Compte courant');

      const patchRes = await agent
        .patch(`/api/v1/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Compte principal' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.name).toBe('Compte principal');

      const deleteRes = await agent
        .delete(`/api/v1/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent
        .get(`/api/v1/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterDelete.status).toBe(404);
    });

    it("rejects access to another user's account", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignAccount] = await db
        .insert(schema.accounts)
        .values({ userId: otherUser!.id, name: 'Not yours', type: 'checking', balance: 0 })
        .returning();

      const res = await agent
        .get(`/api/v1/accounts/${foreignAccount!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /:id/balance-history', () => {
    it('reconstructs daily balances by walking transactions backward from the current balance', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId, name: 'Compte', type: 'checking', balance: 1000 })
        .returning();

      const today = new Date();
      today.setUTCHours(12, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // Balance is currently 1000, and a +200 transaction happened yesterday,
      // so the balance the day before yesterday must have been 800.
      await db.insert(schema.transactions).values({
        accountId: account!.id,
        amount: 200,
        type: 'income',
        date: yesterday,
      });

      const res = await agent
        .get(`/api/v1/accounts/${account!.id}/balance-history`)
        .query({ days: 3 })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const points = res.body.data as { date: string; balance: number }[];
      expect(points.at(-1).balance).toBe(1000);
      expect(points[0].balance).toBe(800);
    });
  });

  describe('POST /:id/import/csv', () => {
    it('imports a CSV file and deduplicates on re-import', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId, name: 'Compte', type: 'checking', balance: 0 })
        .returning();

      const csv = [
        'Date,Description,Amount,Fee,Currency,State,Balance',
        '2026-01-05,Carrefour Market,-45.90,0.00,EUR,COMPLETED,1000.00',
        '2026-01-06,Salary,2000.00,0.00,EUR,COMPLETED,3000.00',
      ].join('\n');

      const firstImport = await agent
        .post(`/api/v1/accounts/${account!.id}/import/csv`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from(csv), 'export.csv');

      expect(firstImport.status).toBe(200);
      expect(firstImport.body.data).toEqual({ imported: 2, skipped: 0, total: 2 });

      const secondImport = await agent
        .post(`/api/v1/accounts/${account!.id}/import/csv`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from(csv), 'export.csv');

      expect(secondImport.status).toBe(200);
      expect(secondImport.body.data).toEqual({ imported: 0, skipped: 2, total: 2 });
    });
  });

  describe('POST /:id/sync/revolut', () => {
    it('returns 501 when Revolut is not configured', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId, name: 'Compte', type: 'checking', balance: 0 })
        .returning();

      const res = await agent
        .post(`/api/v1/accounts/${account!.id}/sync/revolut`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe('REVOLUT_NOT_CONFIGURED');
    });
  });
});
