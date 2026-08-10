// Mirrors the Drizzle `$inferSelect` / Zod input shapes on the backend (see
// backend/src/db/schema/*.ts and backend/src/modules/*/*.schema.ts). Kept
// frontend-local rather than in `shared/types` since the backend doesn't
// export response DTOs of its own.

export type AccountType = 'checking' | 'savings' | 'investment';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  institution: string | null;
  balance: number;
  currency: string;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  institution?: string;
  balance?: number;
  currency?: string;
  color?: string;
  icon?: string;
}

export type UpdateAccountInput = Partial<CreateAccountInput> & { isActive?: boolean };

export interface BalancePoint {
  date: string;
  balance: number;
}

export interface CsvImportResult {
  imported: number;
  skipped: number;
  total: number;
}

export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
  color?: string;
  icon?: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionSource = 'manual' | 'revolut_api' | 'csv_import';

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  type: TransactionType;
  categoryId: string | null;
  description: string | null;
  date: string;
  source: TransactionSource;
  externalId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionInput {
  accountId: string;
  amount: number;
  currency?: string;
  type: TransactionType;
  categoryId?: string;
  description?: string;
  date: string;
  notes?: string;
}

export type UpdateTransactionInput = Partial<Omit<CreateTransactionInput, 'accountId'>>;

export interface ListTransactionsQuery {
  accountId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: TransactionType;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface TransactionStatsByCategory {
  categoryId: string | null;
  categoryName: string | null;
  total: number;
}

export interface TransactionStatsByMonth {
  month: string;
  totalIncome: number;
  totalExpense: number;
}

export interface TransactionStats {
  byCategory: TransactionStatsByCategory[];
  byMonth: TransactionStatsByMonth[];
}

export interface BudgetLineView {
  id: string;
  categoryId: string;
  categoryName: string;
  plannedAmount: number;
  actualAmount: number;
}

export interface BudgetCurrentView {
  id: string;
  month: string;
  totalIncome: number;
  totalPlanned: number;
  totalActual: number;
  lines: BudgetLineView[];
}

export interface BudgetYearlyMonth {
  month: string;
  totalPlanned: number;
  totalActual: number;
  variance: number;
}

export type SavingsGoalType = 'emergency_fund' | 'custom';

export interface SavingsGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  color: string | null;
  icon: string | null;
  type: SavingsGoalType;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavingsGoalInput {
  name: string;
  targetAmount: number;
  deadline?: string;
  color?: string;
  icon?: string;
  type?: SavingsGoalType;
}

export type UpdateSavingsGoalInput = Partial<CreateSavingsGoalInput>;

export interface SavingsMilestone {
  id: string;
  goalId: string;
  name: string;
  targetAmount: number;
  reachedAt: string | null;
}

export interface SavingsMilestonesView {
  reached: SavingsMilestone[];
  next: { percentage: number; amount: number; progress: number; missingAmount: number }[];
}

export interface SavingsDeposit {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  notes: string | null;
}

export interface DepositResult {
  goal: SavingsGoal;
  reachedMilestones: SavingsMilestone[];
}

export interface InvestmentAccount {
  id: string;
  userId: string;
  name: string;
  platform: string | null;
  currentValue: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvestmentAccountInput {
  name: string;
  platform?: string;
  currentValue?: number;
  currency?: string;
}

export type UpdateInvestmentAccountInput = Partial<CreateInvestmentAccountInput>;

export interface InvestmentEntry {
  id: string;
  investmentAccountId: string;
  date: string;
  amountInvested: number;
  portfolioValue: number;
  notes: string | null;
  ticker: string | null;
}

export interface CreateEntryInput {
  date: string;
  amountInvested: number;
  portfolioValue: number;
  notes?: string;
  ticker?: string;
}

export interface StockQuote {
  symbol: string;
  price: number;
  changePercent: number;
  fetchedAt: string;
}

export interface InvestmentMilestoneRow {
  id: string;
  userId: string;
  amount: number;
  reachedAt: string | null;
}

export interface AddEntryResult {
  entry: InvestmentEntry;
  reachedMilestones: InvestmentMilestoneRow[];
}

export interface InvestmentMilestonesView {
  reached: InvestmentMilestoneRow[];
  next: { amount: number; progress: number; missingAmount: number }[];
  currentTotal: number;
}

export interface Credit {
  id: string;
  userId: string;
  name: string;
  institution: string;
  initialAmount: number;
  remainingAmount: number;
  monthlyPayment: number;
  interestRate: number;
  startDate: string;
  endDate: string;
  earlyRepaymentFeeRate: number;
  currency: string;
}

export interface CreateCreditInput {
  name: string;
  institution: string;
  initialAmount: number;
  remainingAmount: number;
  monthlyPayment: number;
  interestRate: number;
  startDate: string;
  endDate: string;
  earlyRepaymentFeeRate?: number;
  currency?: string;
}

export type UpdateCreditInput = Partial<CreateCreditInput>;

export interface CreditPayment {
  id: string;
  creditId: string;
  date: string;
  amount: number;
  principalPart: number;
  interestPart: number;
}

export interface RecordCreditPaymentInput {
  date: string;
  amount: number;
  principalPart: number;
  interestPart: number;
}

export interface CreditSimulationPoint {
  month: number;
  date: string;
  doNothing: number;
  earlyRepayment: number;
}

export interface CreditSimulation {
  earlyRepaymentDate: string;
  monthsUntilRepayment: number;
  totalRemaining: number;
  interestSaved: number;
  earlyRepaymentFee: number;
  netGain: number;
  freedMonthlyBudget: number;
  investmentProjection: number;
  points: CreditSimulationPoint[];
}

export interface ProjectionPoint {
  month: number;
  date: string;
  value: number;
}

export interface ProjectionMilestone {
  amount: number;
  reached: boolean;
  estimatedDate: string | null;
}

export interface ProjectionResult {
  points: ProjectionPoint[];
  milestones: ProjectionMilestone[];
}

export interface ProjectionQuery {
  monthlyContribution?: number;
  annualRate?: number;
  years?: number;
}

export type CryptoPlatform = 'metamask' | 'phantom' | 'crypto_com';
export type CryptoChain = 'ethereum' | 'solana';

export interface CryptoWallet {
  id: string;
  userId: string;
  name: string;
  platform: CryptoPlatform;
  address: string;
  chain: CryptoChain;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWalletInput {
  name: string;
  platform: CryptoPlatform;
  address: string;
  chain: CryptoChain;
}

export type UpdateWalletInput = Partial<CreateWalletInput> & { isActive?: boolean };

export interface CryptoSnapshot {
  id: string;
  walletId: string;
  fetchedAt: string;
  totalValueUsd: number;
  rawData: unknown;
}

export interface WalletToken {
  symbol: string;
  name: string | null;
  amount: number;
  priceUsd: number | null;
  valueUsdCents: number | null;
  change24hPct: number | null;
}

export interface WalletTokensResponse {
  tokens: WalletToken[];
  note: string | null;
}

export type CollectibleItemType = 'card' | 'sealed';
export type CollectibleCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
export type CollectibleSealedType = 'booster_box' | 'etb' | 'blister' | 'collection' | 'display';
export type CollectibleSealedLanguage = 'FR' | 'EN' | 'JP';
export type CollectiblePriceSource = 'tcgdex' | 'manual' | 'pokemonpricetracker' | 'poketrace';

export interface CollectibleItem {
  id: string;
  userId: string;
  itemType: CollectibleItemType;
  name: string;
  setName: string | null;
  imageUrl: string | null;
  notes: string | null;
  purchasePrice: number;
  purchaseDate: string;
  priceSource: CollectiblePriceSource;
  cardNumber: string | null;
  condition: CollectibleCondition | null;
  tcgdexId: string | null;
  sealedType: CollectibleSealedType | null;
  sealedLanguage: CollectibleSealedLanguage | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateCollectibleInput =
  | {
      itemType: 'card';
      name: string;
      setName?: string;
      imageUrl?: string;
      notes?: string;
      purchasePrice: number;
      purchaseDate: string;
      cardNumber?: string;
      condition?: CollectibleCondition;
      tcgdexId?: string;
      priceSource?: 'tcgdex' | 'manual';
    }
  | {
      itemType: 'sealed';
      name: string;
      setName?: string;
      imageUrl?: string;
      notes?: string;
      purchasePrice: number;
      purchaseDate: string;
      sealedType?: CollectibleSealedType;
      sealedLanguage?: CollectibleSealedLanguage;
      priceSource?: 'manual' | 'pokemonpricetracker' | 'poketrace';
    };

export type CollectiblePriceSnapshotSource =
  | 'tcgdex_cardmarket'
  | 'tcgdex_tcgplayer'
  | 'pokemonpricetracker'
  | 'poketrace'
  | 'manual';

export interface CollectiblePriceSnapshot {
  id: string;
  itemId: string;
  fetchedAt: string;
  marketPriceEur: number | null;
  marketPriceUsd: number | null;
  source: CollectiblePriceSnapshotSource;
  rawData: unknown;
}

export interface CollectibleWithHistory {
  item: CollectibleItem;
  history: CollectiblePriceSnapshot[];
}

export interface UpdateCollectibleInput {
  name?: string;
  setName?: string;
  imageUrl?: string;
  notes?: string;
  purchasePrice?: number;
  purchaseDate?: string;
  priceSource?: CollectiblePriceSource;
  cardNumber?: string;
  condition?: CollectibleCondition;
  tcgdexId?: string;
  sealedType?: CollectibleSealedType;
  sealedLanguage?: CollectibleSealedLanguage;
}

export interface ManualPriceUpdateInput {
  priceEur: number;
  priceUsd?: number;
  note?: string;
}

export interface SyncPricesResult {
  synced: number;
  skipped: number;
  errors: number;
}

export interface CollectiblePerformanceRow {
  id: string;
  name: string;
  itemType: CollectibleItemType;
  purchasePrice: number;
  currentPrice: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;
}

export interface CollectiblePerformance {
  items: CollectiblePerformanceRow[];
  totals: {
    totalInvested: number;
    totalCurrentValue: number;
    totalGainLossPct: number;
  };
}

export interface CardSearchResult {
  tcgdexId: string;
  name: string;
  setName: string | null;
  cardNumber: string | null;
  imageUrl: string | null;
}

export interface CollectiblesConfig {
  pokemonPriceTrackerConfigured: boolean;
  poketraceConfigured: boolean;
}

export interface SettingsStatus {
  etherscanConfigured: boolean;
  cryptoComConfigured: boolean;
  pokemonPriceTrackerConfigured: boolean;
  poketraceConfigured: boolean;
  revolutConfigured: boolean;
  alphaVantageConfigured: boolean;
}

export interface UpdateSettingsInput {
  etherscanApiKey?: string;
  cryptoComApiKey?: string;
  cryptoComApiSecret?: string;
  pokemonPriceTrackerApiKey?: string;
  poketraceApiKey?: string;
  revolutClientId?: string;
  revolutClientSecret?: string;
  alphaVantageApiKey?: string;
}

export type TestSettingInput =
  | { section: 'etherscan'; etherscanApiKey: string }
  | { section: 'cryptoCom'; cryptoComApiKey: string; cryptoComApiSecret: string }
  | { section: 'pokemonPriceTracker'; pokemonPriceTrackerApiKey: string }
  | { section: 'poketrace'; poketraceApiKey: string }
  | { section: 'revolut'; revolutClientId: string; revolutClientSecret: string }
  | { section: 'alphaVantage'; alphaVantageApiKey: string };

export interface TestSettingResult {
  success: boolean;
  message: string;
}

export type DisplayCurrency = 'EUR' | 'USD' | 'CAD';

export interface ExchangeRates {
  date: string;
  base: string;
  rates: Record<string, number>;
}
