import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/config/database.js';

const app = createApp();

async function registerAndGetToken() {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/v1/auth/register')
    .send({ email: 'test@example.com', password: 'correcthorsebattery', name: 'Test User' });
  const accessToken = res.body.data.accessToken as string;
  return { agent, accessToken };
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE exchange_rates`);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('exchange rates module', () => {
  it('fetches and caches today\'s rates on first request', async () => {
    const { agent, accessToken } = await registerAndGetToken();
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ amount: 1, base: 'EUR', date: '2026-08-10', rates: { USD: 1.08, CAD: 1.47 } }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await agent
      .get('/api/v1/exchange-rates/latest')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.base).toBe('EUR');
    expect(res.body.data.rates).toEqual({ EUR: 1, USD: 1.08, CAD: 1.47 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves the cached row on a second request without calling Frankfurter again', async () => {
    const { agent, accessToken } = await registerAndGetToken();
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ amount: 1, base: 'EUR', date: '2026-08-10', rates: { USD: 1.08, CAD: 1.47 } }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await agent.get('/api/v1/exchange-rates/latest').set('Authorization', `Bearer ${accessToken}`);
    const res = await agent
      .get('/api/v1/exchange-rates/latest')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/exchange-rates/latest');
    expect(res.status).toBe(401);
  });
});
