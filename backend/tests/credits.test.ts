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

async function createAccount(userId: string) {
  const [account] = await db
    .insert(schema.accounts)
    .values({ userId, name: 'Compte courant', type: 'checking', balance: 0 })
    .returning();
  return account!;
}

async function createExpenseTransaction(accountId: string, amount: number, description: string, date: Date) {
  const [txn] = await db
    .insert(schema.transactions)
    .values({ accountId, amount, type: 'expense', description, date })
    .returning();
  return txn!;
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

  describe('suggested payments (transaction linking)', () => {
    async function createCredit(agent: ReturnType<typeof request.agent>, accessToken: string) {
      const today = new Date();
      const res = await agent
        .post('/api/v1/credits')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Prêt immobilier',
          institution: 'Banque Populaire',
          initialAmount: 1_000_000,
          remainingAmount: 1_000_000,
          monthlyPayment: 50_000,
          interestRate: 0,
          startDate: addMonths(today, -6).toISOString(),
          endDate: addMonths(today, 200).toISOString(),
        });
      return res.body.data.id as string;
    }

    it('suggests transactions matching by amount or by institution keyword, ignores unrelated ones', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const creditId = await createCredit(agent, accessToken);
      const account = await createAccount(userId);
      const today = new Date();

      const amountMatch = await createExpenseTransaction(account.id, -50_000, 'PRLV DIVERS', today);
      const keywordMatch = await createExpenseTransaction(
        account.id,
        -20_000, // doesn't match the amount at all — must match by keyword alone
        'PRLV BANQUE POPULAIRE CREDIT',
        today,
      );
      await createExpenseTransaction(account.id, -3_000, 'CARREFOUR MARKET', today);

      const res = await agent
        .get(`/api/v1/credits/${creditId}/suggested-payments`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((s: { transactionId: string }) => s.transactionId);
      expect(ids).toContain(amountMatch.id);
      expect(ids).toContain(keywordMatch.id);
      expect(ids).toHaveLength(2);
    });

    it('does not suggest an unrelated transaction just because its amount is close (not exact)', async () => {
      // Regression test for a real false positive found live: a 45,78€ phone bill and a 45,36€
      // grocery purchase both matched a 45,59€ credit installment under a percentage tolerance,
      // purely by coincidence. Amount matching must be exact.
      const { agent, accessToken, userId } = await registerAndGetToken();
      const creditId = await createCredit(agent, accessToken); // monthlyPayment: 50_000
      const account = await createAccount(userId);
      const today = new Date();

      await createExpenseTransaction(account.id, -50_019, 'CB FREE MOBILE FACT', today);
      await createExpenseTransaction(account.id, -49_977, 'CB LECLERC FACT', today);

      const res = await agent
        .get(`/api/v1/credits/${creditId}/suggested-payments`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('links a suggested payment, decreasing remainingAmount, and excludes it from future suggestions', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const creditId = await createCredit(agent, accessToken);
      const account = await createAccount(userId);
      const txn = await createExpenseTransaction(account.id, -50_000, 'PRLV DIVERS', new Date());

      const linkRes = await agent
        .post(`/api/v1/credits/${creditId}/payments/link`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ transactionId: txn.id });

      expect(linkRes.status).toBe(201);
      expect(linkRes.body.data.payment.principalPart).toBe(50_000); // 0% interest
      expect(linkRes.body.data.credit.remainingAmount).toBe(950_000);

      const paymentsRes = await agent
        .get(`/api/v1/credits/${creditId}/payments`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(paymentsRes.body.data).toHaveLength(1);
      expect(paymentsRes.body.data[0].transactionId).toBe(txn.id);

      const suggestedRes = await agent
        .get(`/api/v1/credits/${creditId}/suggested-payments`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(suggestedRes.body.data).toHaveLength(0);
    });

    it('rejects linking a transaction that is already linked to a payment', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const creditId = await createCredit(agent, accessToken);
      const account = await createAccount(userId);
      const txn = await createExpenseTransaction(account.id, -50_000, 'PRLV DIVERS', new Date());

      await agent
        .post(`/api/v1/credits/${creditId}/payments/link`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ transactionId: txn.id });

      const secondLink = await agent
        .post(`/api/v1/credits/${creditId}/payments/link`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ transactionId: txn.id });

      expect(secondLink.status).toBe(409);
    });

    it('unlinking a payment restores the principal it had paid down', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const creditId = await createCredit(agent, accessToken);
      const account = await createAccount(userId);
      const txn = await createExpenseTransaction(account.id, -50_000, 'PRLV DIVERS', new Date());

      const linkRes = await agent
        .post(`/api/v1/credits/${creditId}/payments/link`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ transactionId: txn.id });
      const paymentId = linkRes.body.data.payment.id as string;
      expect(linkRes.body.data.credit.remainingAmount).toBe(950_000);

      const unlinkRes = await agent
        .delete(`/api/v1/credits/${creditId}/payments/${paymentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(unlinkRes.status).toBe(200);
      expect(unlinkRes.body.data.remainingAmount).toBe(1_000_000);

      const suggestedRes = await agent
        .get(`/api/v1/credits/${creditId}/suggested-payments`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(suggestedRes.body.data).toHaveLength(1);
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
