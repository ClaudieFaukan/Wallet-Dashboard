import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/config/database.js';
import * as schema from '../src/db/schema/index.js';
import { DEFAULT_CATEGORIES } from '../src/db/seeds/categories.js';

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

describe('categories module', () => {
  it('seeds default categories at registration', async () => {
    const { agent, accessToken } = await registerAndGetToken();
    const res = await agent.get('/api/v1/categories').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(res.body.data.every((c: { isDefault: boolean }) => c.isDefault)).toBe(true);
    expect(res.body.data.map((c: { name: string }) => c.name)).toEqual(
      expect.arrayContaining(DEFAULT_CATEGORIES.map((c) => c.name)),
    );
  });

  it('allows creating and deleting a custom category', async () => {
    const { agent, accessToken } = await registerAndGetToken();
    const createRes = await agent
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Custom', type: 'expense' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.isDefault).toBe(false);

    const deleteRes = await agent
      .delete(`/api/v1/categories/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(deleteRes.status).toBe(204);
  });

  it('rejects deleting a default category', async () => {
    const { agent, accessToken } = await registerAndGetToken();
    const listRes = await agent.get('/api/v1/categories').set('Authorization', `Bearer ${accessToken}`);
    const defaultCategory = listRes.body.data[0];

    const deleteRes = await agent
      .delete(`/api/v1/categories/${defaultCategory.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.error.code).toBe('CATEGORY_IS_DEFAULT');
  });
});
