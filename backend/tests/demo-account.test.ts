import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/config/database.js';
import * as schema from '../src/db/schema/index.js';

const app = createApp();

async function loginDemoUser() {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/v1/auth/login')
    .send({ email: 'demo@finance.app', password: 'demo123' });
  const accessToken = res.body.data.accessToken as string;
  return { agent, accessToken };
}

describe('FEAT-09 demo account', () => {
  it('allows read requests for the demo account', async () => {
    const { agent, accessToken } = await loginDemoUser();
    const res = await agent.get('/api/v1/accounts').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it('allows mutating requests for the demo account, unlike the old read-only mode', async () => {
    const { agent, accessToken } = await loginDemoUser();
    const createRes = await agent
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Nouveau compte', type: 'checking' });
    expect(createRes.status).toBe(201);

    const deleteRes = await agent
      .delete(`/api/v1/accounts/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);
  });

  it('allows adding and editing categories for the demo account', async () => {
    const { agent, accessToken } = await loginDemoUser();
    const res = await agent
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Test démo', type: 'expense', color: '#000000', icon: 'tag' });
    expect(res.status).toBe(201);
  });

  it('rejects a settings mutation with 403 DEMO_READ_ONLY', async () => {
    const { agent, accessToken } = await loginDemoUser();
    const res = await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alphaVantageApiKey: 'sk-test' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEMO_READ_ONLY');
  });

  it('does not mark a regular user as demo', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/v1/auth/register')
      .send({ email: 'real@example.com', password: 'correcthorsebattery', name: 'Real User' });
    const accessToken = res.body.data.accessToken as string;

    const createRes = await agent
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Compte réel', type: 'checking' });

    expect(createRes.status).toBe(201);
  });

  it('reseeds a fresh account on every login, discarding the previous session\'s changes', async () => {
    const first = await loginDemoUser();
    const createRes = await first.agent
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ name: 'Compte de test à jeter', type: 'checking' });
    expect(createRes.status).toBe(201);

    const second = await loginDemoUser();
    const listRes = await second.agent
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${second.accessToken}`);
    expect(listRes.status).toBe(200);
    const names = listRes.body.data.map((a: { name: string }) => a.name);
    expect(names).not.toContain('Compte de test à jeter');
    // The standard demo fixtures are back.
    expect(names).toEqual(expect.arrayContaining(["Caisse d'Épargne", 'Revolut', 'Trade Republic']));
  });

  it('copies the real (non-demo) user\'s own collectibles into the demo account', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/v1/auth/register')
      .send({ email: 'collector@example.com', password: 'correcthorsebattery', name: 'Collector' });
    const [realUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'collector@example.com'));

    await db.insert(schema.collectibleItems).values({
      userId: realUser!.id,
      itemType: 'card',
      name: 'Une carte bien à moi',
      purchasePrice: 1234,
      purchaseDate: '2026-01-01',
      priceSource: 'manual',
    });

    const { agent: demoAgent, accessToken: demoToken } = await loginDemoUser();
    const res = await demoAgent
      .get('/api/v1/collectibles')
      .set('Authorization', `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((c: { name: string }) => c.name);
    expect(names).toContain('Une carte bien à moi');
  });
});
