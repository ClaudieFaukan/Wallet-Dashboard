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

describe('real estate module', () => {
  describe('CRUD', () => {
    it('creates, gets, updates and deletes a physical asset', async () => {
      const { agent, accessToken } = await registerAndGetToken();

      const createRes = await agent
        .post('/api/v1/real-estate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Appartement Lyon',
          type: 'physical',
          purchasePrice: 20_000_000,
          currentValue: 22_000_000,
          purchaseDate: '2022-03-01',
          monthlyIncome: 80_000,
          surfaceM2: 45,
          location: 'Lyon 6e',
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.platform).toBeNull();
      const assetId = createRes.body.data.id as string;

      const getRes = await agent
        .get(`/api/v1/real-estate/${assetId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe('Appartement Lyon');
      expect(getRes.body.data.surfaceM2).toBe(45);

      const patchRes = await agent
        .patch(`/api/v1/real-estate/${assetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ monthlyIncome: 85_000 });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.monthlyIncome).toBe(85_000);

      const deleteRes = await agent
        .delete(`/api/v1/real-estate/${assetId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent
        .get(`/api/v1/real-estate/${assetId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterDelete.status).toBe(404);
    });

    it('creates an SCPI asset and a crowdfunding asset with a platform', async () => {
      const { agent, accessToken } = await registerAndGetToken();

      const scpiRes = await agent
        .post('/api/v1/real-estate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'SCPI Corum',
          type: 'scpi',
          purchasePrice: 500_000,
          currentValue: 520_000,
          purchaseDate: '2023-06-01',
          monthlyIncome: 3_000,
        });
      expect(scpiRes.status).toBe(201);

      const crowdfundingRes = await agent
        .post('/api/v1/real-estate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Projet Brick',
          type: 'crowdfunding',
          platform: 'brick',
          purchasePrice: 100_000,
          currentValue: 100_000,
          purchaseDate: '2024-01-15',
          monthlyIncome: 1_000,
        });
      expect(crowdfundingRes.status).toBe(201);
      expect(crowdfundingRes.body.data.platform).toBe('brick');
    });

    it("rejects access to another user's asset", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignAsset] = await db
        .insert(schema.realEstateAssets)
        .values({
          userId: otherUser!.id,
          name: 'Not yours',
          type: 'physical',
          purchasePrice: 100_000,
          currentValue: 100_000,
          purchaseDate: '2024-01-01',
        })
        .returning();

      const res = await agent
        .get(`/api/v1/real-estate/${foreignAsset!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /:id/value', () => {
    it('records a value point and updates currentValue', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/real-estate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'SCPI Corum',
          type: 'scpi',
          purchasePrice: 500_000,
          currentValue: 500_000,
          purchaseDate: '2023-06-01',
        });
      const assetId = createRes.body.data.id as string;

      const valueRes = await agent
        .post(`/api/v1/real-estate/${assetId}/value`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-01T00:00:00.000Z', value: 540_000, notes: 'Prix de part publié' });

      expect(valueRes.status).toBe(201);
      expect(valueRes.body.data.asset.currentValue).toBe(540_000);
      expect(valueRes.body.data.point.value).toBe(540_000);

      const historyRes = await agent
        .get(`/api/v1/real-estate/${assetId}/history`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data).toHaveLength(1);
      expect(historyRes.body.data[0].value).toBe(540_000);
    });
  });
});
