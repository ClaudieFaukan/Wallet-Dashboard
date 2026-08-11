/**
 * FEAT-09 (docs/feat1.md) — generates a full demo account, editable like a real one.
 * Reused from two places: the CLI script (`npm run db:seed:demo`, one-off/manual) and
 * `AuthService.login()` (automatic, on every login with the demo credentials — see
 * that method for why: the demo account is now writable, so each session needs to
 * start from a clean slate rather than whatever the previous visitor left behind).
 * Idempotent: deletes any previous demo user (cascades everything) before reseeding.
 */
import bcrypt from 'bcrypt';
import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index.js';
import { DEFAULT_CATEGORIES } from './categories.js';

export const DEMO_EMAIL = 'demo@finance.app';
export const DEMO_PASSWORD = 'demo123';
const BCRYPT_COST = 12;

function randomInt(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

/** Day `day` of the month that is `monthsAgo` months before today (UTC), clamped to not exceed today. */
function dayInMonth(monthsAgo: number, day: number): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, day));
  return d > now ? now : d;
}

/** Same as {@link dayInMonth} but for future dates (e.g. a loan's end date) — no clamping. */
function monthsFromNow(months: number, day: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, day));
}

// Fallback collectibles seed, used only if the real (non-demo) user has none of their own
// to copy yet — see seedDemoCollectibles below.
const FALLBACK_CARDS: Omit<typeof schema.collectibleItems.$inferInsert, 'userId'>[] = [
  { itemType: 'card', name: 'Dracaufeu', setName: 'Écarlate et Violet 151', cardNumber: '006/165', condition: 'NM', purchasePrice: 15_000, purchaseDate: dayInMonth(8, 1).toISOString().slice(0, 10), priceSource: 'manual' },
  { itemType: 'card', name: 'Mewtwo', setName: 'Obsidian Flames', cardNumber: '051/197', condition: 'NM', purchasePrice: 8_000, purchaseDate: dayInMonth(7, 1).toISOString().slice(0, 10), priceSource: 'manual' },
  { itemType: 'card', name: 'Pikachu', setName: 'Célébrations', cardNumber: '005/025', condition: 'LP', purchasePrice: 4_000, purchaseDate: dayInMonth(10, 1).toISOString().slice(0, 10), priceSource: 'manual' },
  { itemType: 'card', name: 'Léviator', setName: 'Écarlate et Violet', cardNumber: '038/198', condition: 'NM', purchasePrice: 3_000, purchaseDate: dayInMonth(6, 1).toISOString().slice(0, 10), priceSource: 'manual' },
  { itemType: 'card', name: 'Ronflex', setName: 'Évolutions Prismatiques', cardNumber: '143/131', condition: 'NM', purchasePrice: 6_000, purchaseDate: dayInMonth(4, 1).toISOString().slice(0, 10), priceSource: 'manual' },
  { itemType: 'card', name: 'Évoli', setName: 'Évolutions Prismatiques', cardNumber: '130/131', condition: 'MP', purchasePrice: 2_500, purchaseDate: dayInMonth(4, 1).toISOString().slice(0, 10), priceSource: 'manual' },
  { itemType: 'card', name: 'Tortank', setName: '151', cardNumber: '009/165', condition: 'NM', purchasePrice: 9_000, purchaseDate: dayInMonth(9, 1).toISOString().slice(0, 10), priceSource: 'manual' },
  { itemType: 'card', name: 'Mélodelfe', setName: 'Écarlate et Violet', cardNumber: '196/198', condition: 'NM', purchasePrice: 3_500, purchaseDate: dayInMonth(5, 1).toISOString().slice(0, 10), priceSource: 'manual' },
];
const FALLBACK_SEALED: Omit<typeof schema.collectibleItems.$inferInsert, 'userId'>[] = [
  { itemType: 'sealed', name: 'Booster Box — Écarlate et Violet 151', sealedType: 'booster_box', sealedLanguage: 'FR', purchasePrice: 25_000, purchaseDate: dayInMonth(8, 1).toISOString().slice(0, 10), priceSource: 'manual' },
  { itemType: 'sealed', name: 'Elite Trainer Box — Obsidian Flames', sealedType: 'etb', sealedLanguage: 'EN', purchasePrice: 6_000, purchaseDate: dayInMonth(7, 1).toISOString().slice(0, 10), priceSource: 'manual' },
  { itemType: 'sealed', name: 'Display — Évolutions Prismatiques', sealedType: 'display', sealedLanguage: 'FR', purchasePrice: 40_000, purchaseDate: dayInMonth(4, 1).toISOString().slice(0, 10), priceSource: 'manual' },
];

/** Copies the real (non-demo) user's own collectibles into the demo account — the demo
 * is meant to showcase the actual product, so it shows actual cards/sealed product
 * rather than a small made-up list. Falls back to a small fictional set only if the
 * real user doesn't have any collectibles yet (e.g. very first run). */
async function seedDemoCollectibles(db: NodePgDatabase<typeof schema>, demoUserId: string): Promise<void> {
  const [realUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.isDemo, false))
    .limit(1);

  const sourceItems = realUser
    ? await db
        .select()
        .from(schema.collectibleItems)
        .where(eq(schema.collectibleItems.userId, realUser.id))
    : [];

  const itemsToInsert: (typeof schema.collectibleItems.$inferInsert)[] =
    sourceItems.length > 0
      ? sourceItems.map(({ id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest }) => ({
          ...rest,
          userId: demoUserId,
        }))
      : [...FALLBACK_CARDS, ...FALLBACK_SEALED].map((item) => ({ ...item, userId: demoUserId }));

  const insertedItems = await db.insert(schema.collectibleItems).values(itemsToInsert).returning();

  if (sourceItems.length > 0) {
    // Copy each source item's price history too, remapped to the new demo item ids —
    // sourceItems and insertedItems are the same length, in the same insert order.
    const sourceIds = sourceItems.map((item) => item.id);
    const newIdByOldId = new Map(sourceItems.map((item, i) => [item.id, insertedItems[i]!.id]));
    const allSnapshots = await db
      .select()
      .from(schema.collectiblePriceSnapshots)
      .where(inArray(schema.collectiblePriceSnapshots.itemId, sourceIds));

    if (allSnapshots.length > 0) {
      await db.insert(schema.collectiblePriceSnapshots).values(
        allSnapshots.map(({ id: _id, itemId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest }) => ({
          ...rest,
          itemId: newIdByOldId.get(itemId)!,
        })),
      );
    }
  } else {
    await db.insert(schema.collectiblePriceSnapshots).values(
      insertedItems.map((item) => ({
        itemId: item.id,
        marketPriceEur: Math.round((item.purchasePrice * randomInt(90, 130)) / 100),
        source: 'manual' as const,
      })),
    );
  }
}

export async function seedDemoAccount(db: NodePgDatabase<typeof schema>) {
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_EMAIL));
  if (existing) {
    await db.delete(schema.users).where(eq(schema.users.id, existing.id));
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
  const [user] = await db
    .insert(schema.users)
    .values({ email: DEMO_EMAIL, passwordHash, name: 'Compte Démo', isDemo: true })
    .returning();
  if (!user) throw new Error('Failed to create demo user');

  // --- Categories ---
  const insertedCategories = await db
    .insert(schema.categories)
    .values(
      DEFAULT_CATEGORIES.map((c) => ({
        userId: user.id,
        name: c.name,
        type: c.type,
        color: c.color,
        icon: c.icon,
        isDefault: true,
      })),
    )
    .returning();
  const categoryId = (name: string): string => {
    const found = insertedCategories.find((c) => c.name === name);
    if (!found) throw new Error(`Unknown category ${name}`);
    return found.id;
  };

  // --- Accounts ---
  const [caisseEpargne, revolut, tradeRepublic] = await db
    .insert(schema.accounts)
    .values([
      { userId: user.id, name: "Caisse d'Épargne", type: 'savings', institution: "Caisse d'Épargne", balance: 245_000 },
      { userId: user.id, name: 'Revolut', type: 'checking', institution: 'Revolut', balance: 89_000 },
      { userId: user.id, name: 'Trade Republic', type: 'investment', institution: 'Trade Republic', balance: 820_000 },
    ])
    .returning();
  if (!caisseEpargne || !revolut || !tradeRepublic) throw new Error('Failed to create demo accounts');

  // --- 18 months of transactions on the Revolut checking account ---
  const transactionRows: (typeof schema.transactions.$inferInsert)[] = [];
  for (let monthsAgo = 17; monthsAgo >= 0; monthsAgo--) {
    transactionRows.push({
      accountId: revolut.id,
      amount: 280_000,
      type: 'income',
      categoryId: categoryId('Revenus'),
      description: 'Salaire',
      date: dayInMonth(monthsAgo, 1),
    });
    transactionRows.push({
      accountId: revolut.id,
      amount: -90_000,
      type: 'expense',
      categoryId: categoryId('Logement'),
      description: 'Loyer',
      date: dayInMonth(monthsAgo, 3),
    });
    transactionRows.push({
      accountId: revolut.id,
      amount: -randomInt(5_500, 7_500),
      type: 'expense',
      categoryId: categoryId('Transport'),
      description: 'Pass Navigo',
      date: dayInMonth(monthsAgo, 2),
    });
    transactionRows.push(
      { accountId: revolut.id, amount: -1_599, type: 'expense', categoryId: categoryId('Abonnements'), description: 'Netflix', date: dayInMonth(monthsAgo, 5) },
      { accountId: revolut.id, amount: -999, type: 'expense', categoryId: categoryId('Abonnements'), description: 'Spotify', date: dayInMonth(monthsAgo, 5) },
    );
    for (const day of [5, 12, 19, 26]) {
      transactionRows.push({
        accountId: revolut.id,
        amount: -randomInt(4_000, 9_000),
        type: 'expense',
        categoryId: categoryId('Alimentation'),
        description: 'Courses',
        date: dayInMonth(monthsAgo, day),
      });
    }
    for (const day of [8, 22]) {
      transactionRows.push({
        accountId: revolut.id,
        amount: -randomInt(2_000, 4_500),
        type: 'expense',
        categoryId: categoryId('Restauration'),
        description: 'Restaurant',
        date: dayInMonth(monthsAgo, day),
      });
    }
    transactionRows.push({
      accountId: revolut.id,
      amount: -randomInt(2_500, 6_000),
      type: 'expense',
      categoryId: categoryId('Loisirs'),
      description: 'Sorties',
      date: dayInMonth(monthsAgo, 15),
    });
    if (monthsAgo % 3 === 0) {
      transactionRows.push({
        accountId: revolut.id,
        amount: -randomInt(2_000, 4_000),
        type: 'expense',
        categoryId: categoryId('Santé'),
        description: 'Pharmacie',
        date: dayInMonth(monthsAgo, 10),
      });
    }
    if (monthsAgo % 2 === 0) {
      transactionRows.push({
        accountId: revolut.id,
        amount: -randomInt(3_000, 7_000),
        type: 'expense',
        categoryId: categoryId('Vêtements'),
        description: 'Shopping',
        date: dayInMonth(monthsAgo, 18),
      });
    }
    if (monthsAgo % 4 === 0) {
      transactionRows.push({
        accountId: revolut.id,
        amount: -randomInt(1_000, 3_000),
        type: 'expense',
        categoryId: categoryId('Autres'),
        description: 'Divers',
        date: dayInMonth(monthsAgo, 27),
      });
    }
  }
  await db.insert(schema.transactions).values(transactionRows);

  // --- Budget for the current month ---
  const currentMonth = dayInMonth(0, 1).toISOString().slice(0, 10);
  const plannedByCategory: Record<string, number> = {
    Logement: 90_000,
    Alimentation: 35_000,
    Restauration: 15_000,
    Transport: 6_000,
    Abonnements: 3_000,
    Santé: 3_000,
    Loisirs: 5_000,
    Vêtements: 5_000,
    Épargne: 20_000,
    Autres: 2_000,
  };
  const [budgetPeriod] = await db
    .insert(schema.budgetPeriods)
    .values({
      userId: user.id,
      month: currentMonth,
      totalIncome: 280_000,
      totalPlanned: Object.values(plannedByCategory).reduce((a, b) => a + b, 0),
    })
    .returning();
  if (!budgetPeriod) throw new Error('Failed to create demo budget period');
  await db.insert(schema.budgetLines).values(
    Object.entries(plannedByCategory).map(([name, plannedAmount]) => ({
      budgetPeriodId: budgetPeriod.id,
      categoryId: categoryId(name),
      plannedAmount,
    })),
  );

  // --- Savings goals ---
  const [emergencyFund, travelGoal] = await db
    .insert(schema.savingsGoals)
    .values([
      { userId: user.id, name: 'Épargne de précaution 6 mois', type: 'emergency_fund', targetAmount: 600_000, currentAmount: 270_000 },
      { userId: user.id, name: 'Projet voyage', type: 'custom', targetAmount: 300_000, currentAmount: 216_000 },
    ])
    .returning();
  if (!emergencyFund || !travelGoal) throw new Error('Failed to create demo savings goals');

  await db.insert(schema.savingsMilestones).values([
    { goalId: emergencyFund.id, name: '25%', targetAmount: 150_000, reachedAt: dayInMonth(1, 15) },
    { goalId: travelGoal.id, name: '25%', targetAmount: 75_000, reachedAt: dayInMonth(4, 10) },
    { goalId: travelGoal.id, name: '50%', targetAmount: 150_000, reachedAt: dayInMonth(2, 10) },
  ]);

  await db.insert(schema.savingsDeposits).values([
    { goalId: emergencyFund.id, amount: 90_000, date: dayInMonth(6, 5) },
    { goalId: emergencyFund.id, amount: 90_000, date: dayInMonth(3, 5) },
    { goalId: emergencyFund.id, amount: 90_000, date: dayInMonth(1, 5) },
    { goalId: travelGoal.id, amount: 72_000, date: dayInMonth(5, 20) },
    { goalId: travelGoal.id, amount: 72_000, date: dayInMonth(3, 20) },
    { goalId: travelGoal.id, amount: 72_000, date: dayInMonth(1, 20) },
  ]);

  // --- Investments: 24 months of DCA, crossing the 20K milestone ---
  const [investmentAccount] = await db
    .insert(schema.investmentAccounts)
    .values({ userId: user.id, name: 'PEA', platform: 'Boursorama', currentValue: 0 })
    .returning();
  if (!investmentAccount) throw new Error('Failed to create demo investment account');

  const MONTHLY_CONTRIBUTION = 80_000;
  const MONTHLY_GROWTH = 1 + 0.07 / 12;
  const MILESTONE_20K = 2_000_000;
  let portfolioValue = 0;
  let milestoneReachedAt: Date | null = null;
  const entryRows: (typeof schema.investmentEntries.$inferInsert)[] = [];
  for (let monthsAgo = 23; monthsAgo >= 0; monthsAgo--) {
    portfolioValue = Math.round(portfolioValue * MONTHLY_GROWTH) + MONTHLY_CONTRIBUTION;
    const date = dayInMonth(monthsAgo, 5);
    entryRows.push({
      investmentAccountId: investmentAccount.id,
      date,
      amountInvested: MONTHLY_CONTRIBUTION,
      portfolioValue,
    });
    if (!milestoneReachedAt && portfolioValue >= MILESTONE_20K) milestoneReachedAt = date;
  }
  await db.insert(schema.investmentEntries).values(entryRows);
  await db
    .update(schema.investmentAccounts)
    .set({ currentValue: portfolioValue })
    .where(eq(schema.investmentAccounts.id, investmentAccount.id));
  if (milestoneReachedAt) {
    await db.insert(schema.investmentMilestones).values({
      userId: user.id,
      amount: MILESTONE_20K,
      reachedAt: milestoneReachedAt,
    });
  }

  // --- Crypto: 1 ETH wallet, 1 Solana wallet ---
  const [ethWallet, solWallet] = await db
    .insert(schema.cryptoWallets)
    .values([
      { userId: user.id, name: 'MetaMask ETH', platform: 'metamask', chain: 'ethereum', address: '0xDe3300000000000000000000000000000De1230' },
      { userId: user.id, name: 'Phantom SOL', platform: 'phantom', chain: 'solana', address: 'Demo1111111111111111111111111111111111111' },
    ])
    .returning();
  if (!ethWallet || !solWallet) throw new Error('Failed to create demo crypto wallets');
  await db.insert(schema.cryptoSnapshots).values([
    { walletId: ethWallet.id, totalValueUsd: 350_000 },
    { walletId: solWallet.id, totalValueUsd: 120_000 },
  ]);

  // --- Collectibles: copied from the real user's own collection (see seedDemoCollectibles) ---
  await seedDemoCollectibles(db, user.id);

  // --- Credit: 1 ongoing mortgage ---
  await db.insert(schema.credits).values({
    userId: user.id,
    name: 'Prêt immobilier',
    institution: 'Crédit Agricole',
    initialAmount: 25_000_000,
    remainingAmount: 19_500_000,
    monthlyPayment: 120_000,
    interestRate: 0.028,
    earlyRepaymentFeeRate: 0.03,
    startDate: dayInMonth(60, 1),
    endDate: monthsFromNow(180, 1), // 15 years from now (25y loan, 5y in)
  });

  return user;
}
