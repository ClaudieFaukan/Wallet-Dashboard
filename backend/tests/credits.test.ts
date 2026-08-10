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

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

describe('credits module', () => {
  describe('CRUD', () => {
    it('creates, gets, updates and deletes a credit', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const today = new Date();

      const createRes = await agent
        .post('/api/v1/credits')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Prêt immobilier',
          institution: 'Crédit Agricole',
          initialAmount: 20_000_000,
          remainingAmount: 15_000_000,
          monthlyPayment: 80_000,
          interestRate: 0.02,
          startDate: addMonths(today, -24).toISOString(),
          endDate: addMonths(today, 200).toISOString(),
          earlyRepaymentFeeRate: 0.03,
        });
      expect(createRes.status).toBe(201);
      const creditId = createRes.body.data.id as string;

      const getRes = await agent
        .get(`/api/v1/credits/${creditId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe('Prêt immobilier');
      expect(getRes.body.data.currency).toBe('EUR');

      const patchRes = await agent
        .patch(`/api/v1/credits/${creditId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Prêt immobilier — résidence principale' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.name).toBe('Prêt immobilier — résidence principale');

      const deleteRes = await agent
        .delete(`/api/v1/credits/${creditId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent
        .get(`/api/v1/credits/${creditId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterDelete.status).toBe(404);
    });

    it("rejects access to another user's credit", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignCredit] = await db
        .insert(schema.credits)
        .values({
          userId: otherUser!.id,
          name: 'Not yours',
          institution: 'Bank',
          initialAmount: 100_000,
          remainingAmount: 100_000,
          monthlyPayment: 10_000,
          interestRate: 0,
          startDate: new Date(),
          endDate: addMonths(new Date(), 10),
        })
        .returning();

      const res = await agent
        .get(`/api/v1/credits/${foreignCredit!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /:id/payments', () => {
    it('records a payment and decreases remainingAmount by its principal part', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const today = new Date();
      const createRes = await agent
        .post('/api/v1/credits')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Prêt auto',
          institution: 'Banque',
          initialAmount: 1_000_000,
          remainingAmount: 1_000_000,
          monthlyPayment: 50_000,
          interestRate: 0,
          startDate: today.toISOString(),
          endDate: addMonths(today, 20).toISOString(),
        });
      const creditId = createRes.body.data.id as string;

      const paymentRes = await agent
        .post(`/api/v1/credits/${creditId}/payments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: today.toISOString(), amount: 50_000, principalPart: 45_000, interestPart: 5_000 });

      expect(paymentRes.status).toBe(201);
      expect(paymentRes.body.data.credit.remainingAmount).toBe(955_000);

      const listRes = await agent
        .get(`/api/v1/credits/${creditId}/payments`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
    });
  });

  describe('GET /:id/simulation', () => {
    it('computes zero-interest amortization exactly (no interest to save, no fee)', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const today = new Date();
      const createRes = await agent
        .post('/api/v1/credits')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Prêt 0%',
          institution: 'Banque',
          initialAmount: 120_000,
          remainingAmount: 120_000,
          monthlyPayment: 10_000,
          interestRate: 0,
          earlyRepaymentFeeRate: 0,
          startDate: today.toISOString(),
          endDate: addMonths(today, 12).toISOString(),
        });
      const creditId = createRes.body.data.id as string;

      const res = await agent
        .get(`/api/v1/credits/${creditId}/simulation`)
        .query({ earlyRepaymentDate: addMonths(today, 6).toISOString() })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.monthsUntilRepayment).toBe(6);
      expect(res.body.data.totalRemaining).toBe(60_000);
      expect(res.body.data.interestSaved).toBe(0);
      expect(res.body.data.earlyRepaymentFee).toBe(0);
      expect(res.body.data.netGain).toBe(0);
      expect(res.body.data.freedMonthlyBudget).toBe(10_000);
      // 6 remaining monthly payments of 100 € invested at 7 %/year, recomputed with the same formula.
      const monthlyRate = 0.07 / 12;
      const expectedProjection = Math.round(10_000 * ((Math.pow(1 + monthlyRate, 6) - 1) / monthlyRate));
      expect(res.body.data.investmentProjection).toBe(expectedProjection);
      expect(res.body.data.points).toHaveLength(13); // months 0..12 inclusive
      expect(res.body.data.points[0].doNothing).toBe(-120_000);
      expect(res.body.data.points[12].doNothing).toBe(0);
    });

    it('applies interest and an early repayment fee', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const today = new Date();
      const createRes = await agent
        .post('/api/v1/credits')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Prêt immobilier',
          institution: 'Banque',
          initialAmount: 20_000_000,
          remainingAmount: 20_000_000,
          monthlyPayment: 100_000,
          interestRate: 0.03,
          earlyRepaymentFeeRate: 0.03,
          startDate: today.toISOString(),
          endDate: addMonths(today, 240).toISOString(),
        });
      const creditId = createRes.body.data.id as string;

      const res = await agent
        .get(`/api/v1/credits/${creditId}/simulation`)
        .query({ earlyRepaymentDate: addMonths(today, 60).toISOString() })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const monthlyRate = 0.03 / 12;
      const growth = Math.pow(1 + monthlyRate, 60);
      const expectedBalance = Math.round(20_000_000 * growth - 100_000 * ((growth - 1) / monthlyRate));
      expect(res.body.data.totalRemaining).toBe(expectedBalance);
      expect(res.body.data.earlyRepaymentFee).toBe(Math.round(expectedBalance * 0.03));
      expect(res.body.data.netGain).toBe(res.body.data.interestSaved - res.body.data.earlyRepaymentFee);
      expect(res.body.data.interestSaved).toBeGreaterThan(0);
    });

    it('clamps an early repayment date past the loan end to the last month', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const today = new Date();
      const createRes = await agent
        .post('/api/v1/credits')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Prêt court',
          institution: 'Banque',
          initialAmount: 60_000,
          remainingAmount: 60_000,
          monthlyPayment: 10_000,
          interestRate: 0,
          startDate: today.toISOString(),
          endDate: addMonths(today, 6).toISOString(),
        });
      const creditId = createRes.body.data.id as string;

      const res = await agent
        .get(`/api/v1/credits/${creditId}/simulation`)
        .query({ earlyRepaymentDate: addMonths(today, 24).toISOString() })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.monthsUntilRepayment).toBe(6);
      expect(res.body.data.totalRemaining).toBe(0);
    });
  });
});
