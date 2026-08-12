import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';
import { parseCsv } from '../../integrations/csv/csv.parser.js';
import { parsePdfStatement } from '../../integrations/pdf/parse-statement.js';
import type { PdfStatementSection } from '../../integrations/pdf/pdf-statement.js';
import { extractPdfLines } from '../../integrations/pdf/pdf.extractor.js';
import type { ParsedTransaction } from '../../integrations/shared/transaction.js';
import { AppError } from '../../shared/utils/AppError.js';
import type { InvestmentsService } from '../investments/investments.service.js';
import type { SavingsService } from '../savings/savings.service.js';
import type { SettingsService } from '../settings/settings.service.js';
import type {
  CreateAccountInput,
  PdfImportConfirmInput,
  PdfImportTarget,
  UpdateAccountInput,
} from './accounts.schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// PDF-imported movements into a savings goal or investment account have no
// dedicated dedup column (unlike `transactions.externalId`) — re-import safety
// instead relies on an exact goalId/accountId + date + amount match. Livret
// and PEA-cash sections are always low-volume (interest credits, occasional
// transfers), so the odds of two genuinely distinct same-day-same-amount
// movements colliding here are low; accepted as a known limitation rather
// than adding a dedup column to two tables whose only writer is manual entry.
function inferInvestmentEntryType(description: string): 'contribution' | 'dividend' | 'fee' {
  const upper = description.toUpperCase();
  if (upper.includes('INTERET') || upper.includes('DIVIDENDE')) return 'dividend';
  if (upper.startsWith('*') || upper.includes('FRAIS') || upper.includes('COTIS')) return 'fee';
  return 'contribution';
}

export class AccountsService {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly settingsService: SettingsService,
    private readonly savingsService: SavingsService,
    private readonly investmentsService: InvestmentsService,
  ) {}

  async list(userId: string) {
    return this.db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  }

  async create(userId: string, input: CreateAccountInput) {
    const [account] = await this.db
      .insert(schema.accounts)
      .values({ userId, ...input })
      .returning();
    return account;
  }

  async getById(userId: string, id: string) {
    const [account] = await this.db
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, userId)));
    if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
    return account;
  }

  async update(userId: string, id: string, input: UpdateAccountInput) {
    await this.getById(userId, id);
    const [account] = await this.db
      .update(schema.accounts)
      .set(input)
      .where(eq(schema.accounts.id, id))
      .returning();
    return account;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.db.delete(schema.accounts).where(eq(schema.accounts.id, id));
  }

  /** One balance snapshot per day for the last `days` days, oldest first. */
  async balanceHistory(userId: string, id: string, days: number) {
    const account = await this.getById(userId, id);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const since = new Date(today.getTime() - days * DAY_MS);

    const rows = await this.db
      .select({ date: schema.transactions.date, amount: schema.transactions.amount })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.accountId, id), gte(schema.transactions.date, since)))
      .orderBy(desc(schema.transactions.date));

    const points: { date: string; balance: number }[] = [];
    let runningBalance = account.balance;
    let txIndex = 0;

    for (let dayStart = today.getTime(); dayStart >= since.getTime(); dayStart -= DAY_MS) {
      const nextDayStart = dayStart + DAY_MS;
      while (txIndex < rows.length && rows[txIndex]!.date.getTime() >= nextDayStart) {
        runningBalance -= rows[txIndex]!.amount;
        txIndex++;
      }
      points.push({ date: new Date(dayStart).toISOString().slice(0, 10), balance: runningBalance });
    }

    return points.reverse();
  }

  async importCsv(userId: string, accountId: string, fileContent: string) {
    const account = await this.getById(userId, accountId);
    const { transactions } = parseCsv(fileContent);
    return this.importTransactions(accountId, account.currency, transactions, 'csv_import');
  }

  /** Parses a bank statement PDF (which may bundle several accounts into one
   * document) without writing anything, so the frontend can show the user
   * which app account/savings goal/investment account each detected section
   * should import into. */
  async previewPdfImport(userId: string, fileBuffer: Buffer) {
    const lines = await extractPdfLines(fileBuffer);
    const sections = parsePdfStatement(lines);
    const accountNumbers = sections.map((s) => s.accountNumber);

    const [accountMatches, goalMatches, investmentMatches] = await Promise.all([
      accountNumbers.length
        ? this.db
            .select({ id: schema.accounts.id, accountNumber: schema.accounts.accountNumber })
            .from(schema.accounts)
            .where(
              and(
                eq(schema.accounts.userId, userId),
                inArray(schema.accounts.accountNumber, accountNumbers),
              ),
            )
        : [],
      accountNumbers.length
        ? this.db
            .select({ id: schema.savingsGoals.id, accountNumber: schema.savingsGoals.accountNumber })
            .from(schema.savingsGoals)
            .where(
              and(
                eq(schema.savingsGoals.userId, userId),
                inArray(schema.savingsGoals.accountNumber, accountNumbers),
              ),
            )
        : [],
      accountNumbers.length
        ? this.db
            .select({
              id: schema.investmentAccounts.id,
              accountNumber: schema.investmentAccounts.accountNumber,
            })
            .from(schema.investmentAccounts)
            .where(
              and(
                eq(schema.investmentAccounts.userId, userId),
                inArray(schema.investmentAccounts.accountNumber, accountNumbers),
              ),
            )
        : [],
    ]);
    const accountIdByNumber = new Map(accountMatches.map((m) => [m.accountNumber, m.id]));
    const goalIdByNumber = new Map(goalMatches.map((m) => [m.accountNumber, m.id]));
    const investmentAccountIdByNumber = new Map(investmentMatches.map((m) => [m.accountNumber, m.id]));

    return sections.map((section) => {
      const dates = section.transactions.map((t) => t.date.getTime());
      return {
        accountLabel: section.accountLabel,
        accountNumber: section.accountNumber,
        transactionCount: section.transactions.length,
        dateRange: dates.length
          ? {
              from: new Date(Math.min(...dates)).toISOString().slice(0, 10),
              to: new Date(Math.max(...dates)).toISOString().slice(0, 10),
            }
          : null,
        suggestedAccountId: accountIdByNumber.get(section.accountNumber) ?? null,
        suggestedSavingsGoalId: goalIdByNumber.get(section.accountNumber) ?? null,
        suggestedInvestmentAccountId: investmentAccountIdByNumber.get(section.accountNumber) ?? null,
        suggestedTargetType: section.suggestedTargetType,
      };
    });
  }

  /** Re-parses the same PDF (the frontend re-sends the file it already has
   * in memory from the preview step, so no server-side upload state is
   * needed) and imports each mapped section into whichever module the user
   * chose, creating a new account/goal/investment account as requested and
   * remembering the account number for future imports. */
  async confirmPdfImport(userId: string, fileBuffer: Buffer, mapping: PdfImportConfirmInput['mapping']) {
    const lines = await extractPdfLines(fileBuffer);
    const sections = parsePdfStatement(lines);
    const sectionByNumber = new Map(sections.map((s) => [s.accountNumber, s]));

    const results = [];
    for (const item of mapping) {
      const section = sectionByNumber.get(item.accountNumber);
      if (!section) {
        throw new AppError(
          400,
          'PDF_SECTION_NOT_FOUND',
          `No section found for account number ${item.accountNumber}`,
        );
      }

      if (item.target.type === 'skip') continue;
      if (item.target.type === 'account') {
        results.push(await this.importPdfSectionIntoAccount(userId, item.accountNumber, item.target, section));
      } else if (item.target.type === 'savings_goal') {
        results.push(
          await this.importPdfSectionIntoSavingsGoal(userId, item.accountNumber, item.target, section),
        );
      } else {
        results.push(
          await this.importPdfSectionIntoInvestmentAccount(
            userId,
            item.accountNumber,
            item.target,
            section,
          ),
        );
      }
    }

    return results;
  }

  private async importPdfSectionIntoAccount(
    userId: string,
    accountNumber: string,
    target: Extract<PdfImportTarget, { type: 'account' }>,
    section: PdfStatementSection,
  ) {
    const accountId = target.accountId
      ? target.accountId
      : (
          await this.create(userId, {
            name: target.createAccount!.name,
            type: target.createAccount!.type,
            balance: 0,
            currency: 'EUR',
          })
        )!.id;

    const account = await this.getById(userId, accountId);
    if (!account.accountNumber) {
      await this.db
        .update(schema.accounts)
        .set({ accountNumber })
        .where(eq(schema.accounts.id, accountId));
    }

    const result = await this.importTransactions(
      accountId,
      account.currency,
      section.transactions,
      'pdf_import',
    );

    // The statement's declared ending balance is the ground truth for this account as of
    // that date — including overdrafts. Without this, a freshly-created (or existing)
    // account keeps whatever balance it had before import, which for a brand new account
    // means 0€ even when the real account is in découvert.
    if (section.endingBalanceCents !== null) {
      await this.db
        .update(schema.accounts)
        .set({ balance: section.endingBalanceCents })
        .where(eq(schema.accounts.id, accountId));
    }

    return { accountNumber, targetType: 'account' as const, targetId: accountId, ...result };
  }

  private async importPdfSectionIntoSavingsGoal(
    userId: string,
    accountNumber: string,
    target: Extract<PdfImportTarget, { type: 'savings_goal' }>,
    section: PdfStatementSection,
  ) {
    const isNewGoal = !target.goalId;
    const goalId = target.goalId
      ? target.goalId
      : (
          await this.db
            .insert(schema.savingsGoals)
            .values({
              userId,
              name: target.createGoal!.name,
              targetAmount: target.createGoal!.targetAmount,
              currentAmount: 0,
            })
            .returning()
        )[0]!.id;

    const [goal] = await this.db
      .select()
      .from(schema.savingsGoals)
      .where(and(eq(schema.savingsGoals.id, goalId), eq(schema.savingsGoals.userId, userId)));
    if (!goal) throw new AppError(404, 'SAVINGS_GOAL_NOT_FOUND', 'Savings goal not found');
    if (!goal.accountNumber) {
      await this.db
        .update(schema.savingsGoals)
        .set({ accountNumber })
        .where(eq(schema.savingsGoals.id, goalId));
    }

    // Unlike an investment account's portfolioValue (a per-entry snapshot), a savings
    // goal's currentAmount is always the sum of every deposit — so a brand new goal
    // needs one synthetic opening deposit for the statement's starting balance, or it
    // would only ever reflect this statement's movements instead of the real total.
    // Skipped when reusing an existing goal, whose currentAmount already reflects
    // everything before this import.
    if (isNewGoal && section.startingBalanceCents) {
      const openingDate = section.transactions[0]
        ? new Date(section.transactions[0].date.getTime() - DAY_MS)
        : new Date();
      await this.savingsService.deposit(userId, goalId, section.startingBalanceCents, {
        date: openingDate,
        notes: 'Solde initial (relevé PDF)',
      });
    }

    let imported = 0;
    let skipped = 0;
    for (const t of section.transactions) {
      const [existing] = await this.db
        .select({ id: schema.savingsDeposits.id })
        .from(schema.savingsDeposits)
        .where(
          and(
            eq(schema.savingsDeposits.goalId, goalId),
            eq(schema.savingsDeposits.date, t.date),
            eq(schema.savingsDeposits.amount, t.amountCents),
          ),
        );
      if (existing) {
        skipped++;
        continue;
      }
      await this.savingsService.deposit(userId, goalId, t.amountCents, {
        date: t.date,
        notes: t.description,
      });
      imported++;
    }

    return {
      accountNumber,
      targetType: 'savings_goal' as const,
      targetId: goalId,
      imported,
      skipped,
      total: section.transactions.length,
    };
  }

  private async importPdfSectionIntoInvestmentAccount(
    userId: string,
    accountNumber: string,
    target: Extract<PdfImportTarget, { type: 'investment_account' }>,
    section: PdfStatementSection,
  ) {
    const investmentAccountId = target.investmentAccountId
      ? target.investmentAccountId
      : (
          await this.investmentsService.create(userId, {
            name: target.createInvestmentAccount!.name,
            platform: target.createInvestmentAccount!.platform,
            currentValue: 0,
            currency: 'EUR',
          })
        )!.id;

    const account = await this.investmentsService.getById(userId, investmentAccountId);
    if (!account.accountNumber) {
      await this.db
        .update(schema.investmentAccounts)
        .set({ accountNumber })
        .where(eq(schema.investmentAccounts.id, investmentAccountId));
    }

    // investment_entries requires a running portfolioValue per entry (there's no separate
    // running-balance concept like accounts.balance) — reconstructed here from the
    // statement's own declared starting balance plus each transaction in order, which by
    // construction lands exactly on the declared ending balance for the final entry.
    let runningBalance = section.startingBalanceCents ?? 0;
    let imported = 0;
    let skipped = 0;
    for (const t of section.transactions) {
      runningBalance += t.amountCents;

      const [existing] = await this.db
        .select({ id: schema.investmentEntries.id })
        .from(schema.investmentEntries)
        .where(
          and(
            eq(schema.investmentEntries.investmentAccountId, investmentAccountId),
            eq(schema.investmentEntries.date, t.date),
            eq(schema.investmentEntries.amountInvested, t.amountCents),
          ),
        );
      if (existing) {
        skipped++;
        continue;
      }

      await this.investmentsService.addEntry(userId, investmentAccountId, {
        date: t.date.toISOString(),
        amountInvested: t.amountCents,
        portfolioValue: runningBalance,
        entryType: inferInvestmentEntryType(t.description),
        notes: t.description,
      });
      imported++;
    }

    return {
      accountNumber,
      targetType: 'investment_account' as const,
      targetId: investmentAccountId,
      imported,
      skipped,
      total: section.transactions.length,
    };
  }

  private async importTransactions(
    accountId: string,
    currency: string,
    transactions: ParsedTransaction[],
    source: 'csv_import' | 'pdf_import',
  ) {
    const externalIds = transactions.map((t) => t.externalId);
    const existing = externalIds.length
      ? await this.db
          .select({ externalId: schema.transactions.externalId })
          .from(schema.transactions)
          .where(
            and(
              eq(schema.transactions.accountId, accountId),
              inArray(schema.transactions.externalId, externalIds),
            ),
          )
      : [];
    const existingIds = new Set(existing.map((e) => e.externalId));
    const toInsert = transactions.filter((t) => !existingIds.has(t.externalId));

    if (toInsert.length > 0) {
      await this.db.insert(schema.transactions).values(
        toInsert.map((t) => ({
          accountId,
          amount: t.amountCents,
          currency,
          type: t.type,
          description: t.description,
          date: t.date,
          source,
          externalId: t.externalId,
        })),
      );
    }

    return {
      imported: toInsert.length,
      skipped: transactions.length - toInsert.length,
      total: transactions.length,
    };
  }

  async syncRevolut(userId: string, accountId: string): Promise<never> {
    await this.getById(userId, accountId);
    // Full OAuth PKCE + fetch/persist wiring is deferred to a dedicated session
    // once real Revolut Developer credentials exist (see integrations/revolut/revolut.client.ts).
    const clientId = await this.settingsService.getValue(userId, 'revolutClientId');
    if (!clientId) {
      throw new AppError(501, 'REVOLUT_NOT_CONFIGURED', 'Revolut sync is not configured yet');
    }
    throw new AppError(501, 'REVOLUT_NOT_CONFIGURED', 'Revolut sync is not implemented yet');
  }
}
