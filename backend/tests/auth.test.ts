import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

const validUser = { email: 'test@example.com', password: 'correcthorsebattery', name: 'Test User' };

describe('POST /api/v1/auth/register', () => {
  it('creates the first user and returns an access token + refresh cookie', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.headers['set-cookie']?.[0]).toMatch(/^refresh_token=/);
  });

  it('rejects registration once a user already exists', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'other@example.com', password: 'whatever123', name: 'Other' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('REGISTRATION_CLOSED');
  });

  it('rejects invalid input', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('rejects a wrong password', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });
    expect(res.status).toBe(401);
  });
});

describe('remember me', () => {
  it('issues a session cookie (no Expires) when rememberMe is not set', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    const cookie = res.headers['set-cookie']?.[0] as string;
    expect(cookie).not.toMatch(/Expires=/i);
  });

  it('issues a persistent cookie when rememberMe is true, preserved across refresh', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const agent = request.agent(app);
    const loginRes = await agent
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password, rememberMe: true });

    expect(loginRes.headers['set-cookie']?.[0]).toMatch(/Expires=/i);

    const refreshRes = await agent.post('/api/v1/auth/refresh');
    expect(refreshRes.headers['set-cookie']?.[0]).toMatch(/Expires=/i);
  });
});

describe('POST /api/v1/auth/refresh and /logout', () => {
  it('refreshes the access token using the refresh cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send(validUser);

    const res = await agent.post('/api/v1/auth/refresh');
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('rejects refresh without a cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('revokes the refresh token on logout, making it unusable afterwards', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send(validUser);

    const logoutRes = await agent.post('/api/v1/auth/logout');
    expect(logoutRes.status).toBe(204);

    const refreshRes = await agent.post('/api/v1/auth/refresh');
    expect(refreshRes.status).toBe(401);
  });
});
