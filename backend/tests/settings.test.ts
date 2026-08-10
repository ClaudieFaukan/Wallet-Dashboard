import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('settings module', () => {
  it('reports everything unconfigured before any key is saved', async () => {
    const { agent, accessToken } = await registerAndGetToken();
    const res = await agent.get('/api/v1/settings').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      etherscanConfigured: false,
      cryptoComConfigured: false,
      pokemonPriceTrackerConfigured: false,
      poketraceConfigured: false,
      revolutConfigured: false,
    });
  });

  it('saves a key, reports it configured, and stores it encrypted (not in plaintext)', async () => {
    const { agent, accessToken, userId } = await registerAndGetToken();

    const putRes = await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ etherscanApiKey: 'super-secret-key' });

    expect(putRes.status).toBe(200);
    expect(putRes.body.data.etherscanConfigured).toBe(true);

    const [row] = await db
      .select()
      .from(schema.appSettings)
      .where(and(eq(schema.appSettings.userId, userId), eq(schema.appSettings.key, 'etherscan_api_key')));
    expect(row).toBeDefined();
    expect(row!.valueEncrypted).not.toContain('super-secret-key');
    expect(row!.valueEncrypted.split(':')).toHaveLength(3);
  });

  it('only reports a paired key (Crypto.com) configured once both fields are set', async () => {
    const { agent, accessToken } = await registerAndGetToken();

    const partial = await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ cryptoComApiKey: 'key-only' });
    expect(partial.body.data.cryptoComConfigured).toBe(false);

    const complete = await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ cryptoComApiSecret: 'secret-too' });
    expect(complete.body.data.cryptoComConfigured).toBe(true);
  });

  it('clears a key when saved with an empty string', async () => {
    const { agent, accessToken } = await registerAndGetToken();

    await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ poketraceApiKey: 'some-key' });

    const cleared = await agent
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ poketraceApiKey: '' });

    expect(cleared.body.data.poketraceConfigured).toBe(false);
  });

  describe('POST /settings/test', () => {
    it('reports success for a valid Etherscan key', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: '1', message: 'OK', result: '1000000000000000000' }),
          }),
        ),
      );

      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'etherscan', etherscanApiKey: 'a-key' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('reports failure for an invalid Etherscan key', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: '0', message: 'Invalid API Key', result: '' }),
          }),
        ),
      );

      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'etherscan', etherscanApiKey: 'bad-key' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(false);
    });

    it('acknowledges Revolut credentials without a live network call', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'revolut', revolutClientId: 'id', revolutClientSecret: 'secret' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('rejects a test request missing required fields for its section', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .post('/api/v1/settings/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ section: 'cryptoCom', cryptoComApiKey: 'key-only' });

      expect(res.status).toBe(400);
    });
  });
});
