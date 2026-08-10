import { describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../src/app.js';
import { db } from '../src/config/database.js';
import * as schema from '../src/db/schema/index.js';

const app = createApp();

async function seedAndLoginDemoUser() {
  const passwordHash = await bcrypt.hash('demo123', 12);
  await db
    .insert(schema.users)
    .values({ email: 'demo@finance.app', passwordHash, name: 'Compte Démo', isDemo: true });

  const agent = request.agent(app);
  const res = await agent
    .post('/api/v1/auth/login')
    .send({ email: 'demo@finance.app', password: 'demo123' });
  const accessToken = res.body.data.accessToken as string;
  return { agent, accessToken };
}

describe('FEAT-09 demo account', () => {
  it('allows read requests for the demo account', async () => {
    const { agent, accessToken } = await seedAndLoginDemoUser();
    const res = await agent.get('/api/v1/accounts').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it('rejects a mutating request with 403 DEMO_READ_ONLY', async () => {
    const { agent, accessToken } = await seedAndLoginDemoUser();
    const res = await agent
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Nouveau compte', type: 'checking' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEMO_READ_ONLY');
  });

  it('rejects a delete request the same way', async () => {
    const { agent, accessToken } = await seedAndLoginDemoUser();
    const res = await agent
      .delete('/api/v1/accounts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

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
});
