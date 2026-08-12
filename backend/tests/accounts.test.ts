import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createApp } from '../src/app.js';
import { db } from '../src/config/database.js';
import * as schema from '../src/db/schema/index.js';

const app = createApp();

// Builds a minimal single-page PDF with one line of text per entry — enough
// for pdf.js text extraction (used by the PDF import parser) without needing
// to reproduce the real statement's multi-column glyph layout.
async function buildStatementPdf(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 760;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 10, font });
    y -= 14;
  }
  return Buffer.from(await doc.save());
}

const CAISSE_EPARGNE_STATEMENT_LINES = [
  'DETAIL DE VOS OPERATIONS',
  'COMPTE DE DEPOT - N° 04093455065',
  'SOLDE DEBITEUR AU 13/06/2026 - 500,00',
  '16/06/2026 16/06/2026 * COTIS BOUQUET LIBERTE - 11,45',
  '01/07/2026 01/07/2026 VIR SEPA FRANCE TRAVAIL NORMAND + 1 424,40',
  'SOLDE CREDITEUR AU 13/07/2026 + 912,95',
  'L.E.P. EN CPTE - N° 05234087765',
  'SOLDE CREDITEUR AU 13/04/2026 + 1 000,00',
  '05/05/2026 16/05/2026 VIR SEPA M PETREL PIERRE-ALAIN + 150,00',
  'SOLDE CREDITEUR AU 13/07/2026 + 1 150,00',
  'NUMERAIRE PEA - N° 21124172269',
  'SOLDE CREDITEUR AU 13/06/2026 + 2 000,00',
  '25/06/2026 25/06/2026 INTERET PSO SLE DIEPPE BRAY BRES + 0,41',
  'SOLDE CREDITEUR AU 13/07/2026 + 2 000,41',
];

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

describe('accounts module', () => {
  describe('CRUD', () => {
    it('creates, lists, gets, updates and deletes an account', async () => {
      const { agent, accessToken } = await registerAndGetToken();

      const createRes = await agent
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Compte courant', type: 'checking', balance: 10000 });
      expect(createRes.status).toBe(201);
      const accountId = createRes.body.data.id as string;

      const listRes = await agent
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);

      const getRes = await agent
        .get(`/api/v1/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe('Compte courant');

      const patchRes = await agent
        .patch(`/api/v1/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Compte principal' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.name).toBe('Compte principal');

      const deleteRes = await agent
        .delete(`/api/v1/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent
        .get(`/api/v1/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterDelete.status).toBe(404);
    });

    it("rejects access to another user's account", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignAccount] = await db
        .insert(schema.accounts)
        .values({ userId: otherUser!.id, name: 'Not yours', type: 'checking', balance: 0 })
        .returning();

      const res = await agent
        .get(`/api/v1/accounts/${foreignAccount!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /:id/balance-history', () => {
    it('reconstructs daily balances by walking transactions backward from the current balance', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId, name: 'Compte', type: 'checking', balance: 1000 })
        .returning();

      const today = new Date();
      today.setUTCHours(12, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // Balance is currently 1000, and a +200 transaction happened yesterday,
      // so the balance the day before yesterday must have been 800.
      await db.insert(schema.transactions).values({
        accountId: account!.id,
        amount: 200,
        type: 'income',
        date: yesterday,
      });

      const res = await agent
        .get(`/api/v1/accounts/${account!.id}/balance-history`)
        .query({ days: 3 })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const points = res.body.data as { date: string; balance: number }[];
      expect(points.at(-1).balance).toBe(1000);
      expect(points[0].balance).toBe(800);
    });
  });

  describe('POST /:id/import/csv', () => {
    it('imports a CSV file and deduplicates on re-import', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId, name: 'Compte', type: 'checking', balance: 0 })
        .returning();

      const csv = [
        'Date,Description,Amount,Fee,Currency,State,Balance',
        '2026-01-05,Carrefour Market,-45.90,0.00,EUR,COMPLETED,1000.00',
        '2026-01-06,Salary,2000.00,0.00,EUR,COMPLETED,3000.00',
      ].join('\n');

      const firstImport = await agent
        .post(`/api/v1/accounts/${account!.id}/import/csv`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from(csv), 'export.csv');

      expect(firstImport.status).toBe(200);
      expect(firstImport.body.data).toEqual({ imported: 2, skipped: 0, total: 2 });

      const secondImport = await agent
        .post(`/api/v1/accounts/${account!.id}/import/csv`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from(csv), 'export.csv');

      expect(secondImport.status).toBe(200);
      expect(secondImport.body.data).toEqual({ imported: 0, skipped: 2, total: 2 });
    });
  });

  describe('POST /import/pdf/preview and /import/pdf/confirm', () => {
    it('previews a multi-account PDF statement with no existing target matched', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const pdf = await buildStatementPdf(CAISSE_EPARGNE_STATEMENT_LINES);

      const res = await agent
        .post('/api/v1/accounts/import/pdf/preview')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pdf, 'releve.pdf');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([
        {
          accountLabel: 'COMPTE DE DEPOT',
          accountNumber: '04093455065',
          transactionCount: 2,
          dateRange: { from: '2026-06-16', to: '2026-07-01' },
          suggestedAccountId: null,
          suggestedSavingsGoalId: null,
          suggestedInvestmentAccountId: null,
          suggestedTargetType: 'account',
        },
        {
          accountLabel: 'L.E.P. EN CPTE',
          accountNumber: '05234087765',
          transactionCount: 1,
          dateRange: { from: '2026-05-05', to: '2026-05-05' },
          suggestedAccountId: null,
          suggestedSavingsGoalId: null,
          suggestedInvestmentAccountId: null,
          suggestedTargetType: 'savings_goal',
        },
        {
          accountLabel: 'NUMERAIRE PEA',
          accountNumber: '21124172269',
          transactionCount: 1,
          dateRange: { from: '2026-06-25', to: '2026-06-25' },
          suggestedAccountId: null,
          suggestedSavingsGoalId: null,
          suggestedInvestmentAccountId: null,
          suggestedTargetType: 'investment_account',
        },
      ]);
    });

    it('routes checking to a bank account (balance set to the declared overdraft), livret to a savings goal, and PEA cash to an investment account', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const pdf = await buildStatementPdf(CAISSE_EPARGNE_STATEMENT_LINES);

      const mapping = [
        {
          accountNumber: '04093455065',
          target: { type: 'account', createAccount: { name: 'Compte courant', type: 'checking' } },
        },
        {
          accountNumber: '05234087765',
          target: { type: 'savings_goal', createGoal: { name: 'LEP', targetAmount: 500000 } },
        },
        {
          accountNumber: '21124172269',
          target: {
            type: 'investment_account',
            createInvestmentAccount: { name: 'PEA espèces' },
          },
        },
      ];

      const confirmRes = await agent
        .post('/api/v1/accounts/import/pdf/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('mapping', JSON.stringify(mapping))
        .attach('file', pdf, 'releve.pdf');

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data).toHaveLength(3);

      // Checking account: transactions imported, balance reflects the statement's
      // declared ending balance (912,95€ — was previously stuck at 0 for new accounts).
      const [checkingResult, savingsResult, investmentResult] = confirmRes.body.data;
      expect(checkingResult).toMatchObject({
        accountNumber: '04093455065',
        targetType: 'account',
        imported: 2,
        skipped: 0,
        total: 2,
      });
      const [account] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, checkingResult.targetId));
      expect(account!.balance).toBe(91295);
      expect(account!.accountNumber).toBe('04093455065');

      // Savings goal: currentAmount = synthetic opening balance (1000€) + the one
      // real deposit (150€) = 1150€, matching the statement's declared ending balance.
      expect(savingsResult).toMatchObject({
        accountNumber: '05234087765',
        targetType: 'savings_goal',
        imported: 1,
        skipped: 0,
        total: 1,
      });
      const [goal] = await db
        .select()
        .from(schema.savingsGoals)
        .where(eq(schema.savingsGoals.id, savingsResult.targetId));
      expect(goal!.currentAmount).toBe(115000);
      expect(goal!.accountNumber).toBe('05234087765');
      const deposits = await db
        .select()
        .from(schema.savingsDeposits)
        .where(eq(schema.savingsDeposits.goalId, savingsResult.targetId));
      expect(deposits).toHaveLength(2); // synthetic opening + the real transaction

      // Investment account: currentValue mirrors the last entry's portfolioValue,
      // itself derived from the statement's starting balance + the real movement.
      expect(investmentResult).toMatchObject({
        accountNumber: '21124172269',
        targetType: 'investment_account',
        imported: 1,
        skipped: 0,
        total: 1,
      });
      const [investmentAccount] = await db
        .select()
        .from(schema.investmentAccounts)
        .where(eq(schema.investmentAccounts.id, investmentResult.targetId));
      expect(investmentAccount!.currentValue).toBe(200041);
      expect(investmentAccount!.accountNumber).toBe('21124172269');
      const entries = await db
        .select()
        .from(schema.investmentEntries)
        .where(eq(schema.investmentEntries.investmentAccountId, investmentResult.targetId));
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ amountInvested: 41, portfolioValue: 200041, entryType: 'dividend' });

      // Re-importing the same statement, now mapping by suggested targets, dedupes
      // everywhere — including the savings/investment paths, which have no
      // externalId column and rely on an exact date+amount lookup instead.
      const previewRes = await agent
        .post('/api/v1/accounts/import/pdf/preview')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pdf, 'releve.pdf');
      expect(previewRes.body.data[0].suggestedAccountId).toBe(checkingResult.targetId);
      expect(previewRes.body.data[1].suggestedSavingsGoalId).toBe(savingsResult.targetId);
      expect(previewRes.body.data[2].suggestedInvestmentAccountId).toBe(investmentResult.targetId);

      const secondMapping = [
        { accountNumber: '04093455065', target: { type: 'account', accountId: checkingResult.targetId } },
        {
          accountNumber: '05234087765',
          target: { type: 'savings_goal', goalId: savingsResult.targetId },
        },
        {
          accountNumber: '21124172269',
          target: { type: 'investment_account', investmentAccountId: investmentResult.targetId },
        },
      ];
      const secondConfirm = await agent
        .post('/api/v1/accounts/import/pdf/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('mapping', JSON.stringify(secondMapping))
        .attach('file', pdf, 'releve.pdf');

      expect(secondConfirm.status).toBe(200);
      for (const result of secondConfirm.body.data) {
        expect(result.imported).toBe(0);
      }
      // No duplicate synthetic opening deposit either — reusing an existing goal
      // never inserts one.
      const depositsAfterSecondImport = await db
        .select()
        .from(schema.savingsDeposits)
        .where(eq(schema.savingsDeposits.goalId, savingsResult.targetId));
      expect(depositsAfterSecondImport).toHaveLength(2);
    });

    it('a "skip" target imports nothing for that section', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const pdf = await buildStatementPdf(CAISSE_EPARGNE_STATEMENT_LINES);

      const res = await agent
        .post('/api/v1/accounts/import/pdf/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .field(
          'mapping',
          JSON.stringify([
            { accountNumber: '04093455065', target: { type: 'skip' } },
            {
              accountNumber: '05234087765',
              target: { type: 'savings_goal', createGoal: { name: 'LEP', targetAmount: 500000 } },
            },
          ]),
        )
        .attach('file', pdf, 'releve.pdf');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].accountNumber).toBe('05234087765');
    });
  });

  describe('POST /import/pdf/preview and /import/pdf/confirm with a Revolut statement', () => {
    it('routes "Compte" to a bank account and "Dépôt" to a savings goal, deriving amounts from balance deltas', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const pdf = await buildStatementPdf([
        '84 Place André Follain IBAN FR7628233000018687457231850',
        'Résumé du solde',
        'Compte (Compte courant) 0,00€ 465,62€ 470,00€ 4,38€',
        'Dépôt 0,00€ 0,00€ 10,00€ 10,00€',
        'Total 0,00€ 465,62€ 480,00€ 14,38€',
        'Transactions du compte : du 24 juillet 2026 au 12 août 2026',
        '29 juil. 2026 Paiement envoyé par M PETREL PIERRE-ALAIN 450,00€ 450,00€',
        '29 juil. 2026 Frais de livraison de carte 7,99€ 442,01€',
        '29 juil. 2026 À EUR Compte d\'épargne 10,00€ 432,01€',
        '29 juil. 2026 To Jean-Francois Tessier 400,64€ 31,37€',
        'Frais: 1,10€ 399,54€',
        '640,00 CAD',
        '4 août 2026 Pizza Jean-Mi 20,00€ 11,37€',
        '4 août 2026 Promotion Reward 20,00€ 31,37€',
        '5 août 2026 Vers le compte d\'investissement 20,00€ 11,37€',
        '8 août 2026 Amazon Prime 6,99€ 4,38€',
        'Transactions de dépôt de 24 juillet 2026 à 12 août 2026',
        '29 juil. 2026 À EUR Compte d\'épargne 10,00€ 10,00€',
      ]);

      const previewRes = await agent
        .post('/api/v1/accounts/import/pdf/preview')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pdf, 'releve.pdf');
      expect(previewRes.status).toBe(200);
      expect(previewRes.body.data.map((s: { suggestedTargetType: string }) => s.suggestedTargetType)).toEqual([
        'account',
        'savings_goal',
      ]);

      const confirmRes = await agent
        .post('/api/v1/accounts/import/pdf/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .field(
          'mapping',
          JSON.stringify([
            {
              accountNumber: previewRes.body.data[0].accountNumber,
              target: { type: 'account', createAccount: { name: 'Revolut', type: 'checking' } },
            },
            {
              accountNumber: previewRes.body.data[1].accountNumber,
              target: { type: 'savings_goal', createGoal: { name: 'Revolut Dépôt', targetAmount: 100000 } },
            },
          ]),
        )
        .attach('file', pdf, 'releve.pdf');

      expect(confirmRes.status).toBe(200);
      const [checkingResult, depositResult] = confirmRes.body.data;
      expect(checkingResult).toMatchObject({ targetType: 'account', imported: 8, skipped: 0, total: 8 });
      expect(depositResult).toMatchObject({ targetType: 'savings_goal', imported: 1, skipped: 0, total: 1 });

      const [account] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, checkingResult.targetId));
      expect(account!.balance).toBe(438); // declared closing balance, 4,38€

      const [goal] = await db
        .select()
        .from(schema.savingsGoals)
        .where(eq(schema.savingsGoals.id, depositResult.targetId));
      expect(goal!.currentAmount).toBe(1000); // no opening balance to synthesize (0,00€ opening)
    });
  });

  describe('POST /import/pdf/confirm with duplicate same-day transactions', () => {
    it('imports two genuinely separate transactions sharing the same date, amount and description', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const pdf = await buildStatementPdf([
        'DETAIL DE VOS OPERATIONS',
        'COMPTE DE DEPOT - N° 04093455065',
        '04/07/2026 04/07/2026 CB BABA YAGA FACT 170626 - 13,00',
        '04/07/2026 04/07/2026 CB BABA YAGA FACT 170626 - 13,00',
      ]);

      const res = await agent
        .post('/api/v1/accounts/import/pdf/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .field(
          'mapping',
          JSON.stringify([
            {
              accountNumber: '04093455065',
              target: { type: 'account', createAccount: { name: 'Compte courant', type: 'checking' } },
            },
          ]),
        )
        .attach('file', pdf, 'releve.pdf');

      expect(res.status).toBe(200);
      expect(res.body.data[0]).toMatchObject({ imported: 2, skipped: 0, total: 2 });
    });
  });

  describe('POST /:id/sync/revolut', () => {
    it('returns 501 when Revolut is not configured', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId, name: 'Compte', type: 'checking', balance: 0 })
        .returning();

      const res = await agent
        .post(`/api/v1/accounts/${account!.id}/sync/revolut`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe('REVOLUT_NOT_CONFIGURED');
    });
  });
});
