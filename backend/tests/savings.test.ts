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

describe('savings module', () => {
  it('creates two default emergency fund goals at registration', async () => {
    const { agent, accessToken } = await registerAndGetToken();
    const res = await agent.get('/api/v1/savings').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((g: { name: string }) => g.name)).toEqual(
      expect.arrayContaining(['Épargne de précaution 6 mois', 'Épargne de précaution 1 an']),
    );
    for (const goal of res.body.data) {
      expect(goal.type).toBe('emergency_fund');
      expect(goal.targetAmount).toBe(0);
      expect(goal.currentAmount).toBe(0);
    }
  });

  describe('CRUD', () => {
    it('creates, gets, updates and deletes a custom goal', async () => {
      const { agent, accessToken } = await registerAndGetToken();

      const createRes = await agent
        .post('/api/v1/savings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Voyage au Japon', targetAmount: 300000, type: 'custom' });
      expect(createRes.status).toBe(201);
      const goalId = createRes.body.data.id as string;

      const getRes = await agent
        .get(`/api/v1/savings/${goalId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe('Voyage au Japon');

      const patchRes = await agent
        .patch(`/api/v1/savings/${goalId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Voyage au Japon 2027' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.name).toBe('Voyage au Japon 2027');

      const deleteRes = await agent
        .delete(`/api/v1/savings/${goalId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent
        .get(`/api/v1/savings/${goalId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterDelete.status).toBe(404);
    });

    it("rejects access to another user's goal", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignGoal] = await db
        .insert(schema.savingsGoals)
        .values({ userId: otherUser!.id, name: 'Not yours', targetAmount: 1000, currentAmount: 0 })
        .returning();

      const res = await agent
        .get(`/api/v1/savings/${foreignGoal!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /:id/deposit', () => {
    it('increases currentAmount and reports newly reached milestones', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/savings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Fonds urgence', targetAmount: 10000, type: 'custom' });
      const goalId = createRes.body.data.id as string;

      const firstDeposit = await agent
        .post(`/api/v1/savings/${goalId}/deposit`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 3000 });

      expect(firstDeposit.status).toBe(200);
      expect(firstDeposit.body.data.goal.currentAmount).toBe(3000);
      expect(firstDeposit.body.data.reachedMilestones).toHaveLength(1);
      expect(firstDeposit.body.data.reachedMilestones[0]).toMatchObject({ name: '25%' });

      const secondDeposit = await agent
        .post(`/api/v1/savings/${goalId}/deposit`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 500 });

      expect(secondDeposit.status).toBe(200);
      expect(secondDeposit.body.data.goal.currentAmount).toBe(3500);
      // Still under 50%, no new milestone and no duplicate of the 25% one.
      expect(secondDeposit.body.data.reachedMilestones).toHaveLength(0);

      const thirdDeposit = await agent
        .post(`/api/v1/savings/${goalId}/deposit`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 6500 });

      expect(thirdDeposit.status).toBe(200);
      expect(thirdDeposit.body.data.goal.currentAmount).toBe(10000);
      const names = thirdDeposit.body.data.reachedMilestones.map((m: { name: string }) => m.name);
      expect(names).toEqual(expect.arrayContaining(['50%', '75%', '100%']));
    });

    it('records each deposit in the history, listed in date order', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/savings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Fonds urgence', targetAmount: 10000, type: 'custom' });
      const goalId = createRes.body.data.id as string;

      await agent
        .post(`/api/v1/savings/${goalId}/deposit`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 3000 });
      await agent
        .post(`/api/v1/savings/${goalId}/deposit`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 500 });

      const res = await agent
        .get(`/api/v1/savings/${goalId}/deposits`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.map((d: { amount: number }) => d.amount)).toEqual([3000, 500]);
    });

    it('does not check milestones for a zero-target goal', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [goal] = await db
        .select()
        .from(schema.savingsGoals)
        .where(eq(schema.savingsGoals.userId, userId))
        .limit(1);

      const res = await agent
        .post(`/api/v1/savings/${goal!.id}/deposit`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 100 });

      expect(res.status).toBe(200);
      expect(res.body.data.reachedMilestones).toHaveLength(0);
    });
  });
});
