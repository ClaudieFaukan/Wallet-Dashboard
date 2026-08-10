import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, PaginationMeta } from '@wallet-dashboard/shared';
import { getAccessToken, useAuthStore } from '../store/authStore';
import type {
  Account,
  AddEntryResult,
  BalancePoint,
  BudgetCurrentView,
  BudgetYearlyMonth,
  CardSearchResult,
  Category,
  CollectiblePerformance,
  CollectiblesConfig,
  CollectibleWithHistory,
  CollectibleItem,
  CreateAccountInput,
  CreateCategoryInput,
  CreateCollectibleInput,
  CreateCreditInput,
  CreateEntryInput,
  CreateInvestmentAccountInput,
  CreateSavingsGoalInput,
  CreateTransactionInput,
  CreateWalletInput,
  Credit,
  CreditPayment,
  CreditSimulation,
  CryptoSnapshot,
  CryptoWallet,
  CsvImportResult,
  DepositResult,
  ExchangeRates,
  InvestmentAccount,
  InvestmentEntry,
  InvestmentMilestonesView,
  ListTransactionsQuery,
  ManualPriceUpdateInput,
  ProjectionQuery,
  ProjectionResult,
  RealEstateAsset,
  RecordRealEstateValueInput,
  RecordRealEstateValueResult,
  RealEstateValuePoint,
  SavingsDeposit,
  SavingsGoal,
  SavingsMilestonesView,
  SettingsStatus,
  StockQuote,
  SyncPricesResult,
  TcgType,
  TestSettingInput,
  TestSettingResult,
  Transaction,
  TransactionStats,
  UpdateAccountInput,
  UpdateTransactionInput,
  UpdateInvestmentAccountInput,
  UpdateSavingsGoalInput,
  UpdateCreditInput,
  UpdateSettingsInput,
  UpdateWalletInput,
  RecordCreditPaymentInput,
  UpdateCollectibleInput,
  UpdateRealEstateAssetInput,
  CreateRealEstateAssetInput,
  WalletTokensResponse,
} from '../types/api';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

const client = axios.create({ baseURL, withCredentials: true });

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const res = await axios.post<ApiResponse<{ accessToken: string }>>(
    `${baseURL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data.accessToken;
}

client.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = original?.url ?? '';
    const isAuthRoute = url.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const token = await refreshPromise;
        useAuthStore.getState().setToken(token);
        return client({
          ...original,
          headers: { ...original.headers, Authorization: `Bearer ${token}` },
        });
      } catch (refreshError) {
        useAuthStore.getState().clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data;
}

async function unwrapWithMeta<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
): Promise<{ data: T; meta?: PaginationMeta }> {
  const res = await promise;
  if (!res.data.success) throw new Error(res.data.error.message);
  return { data: res.data.data, meta: res.data.meta };
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown> | undefined;
    if (data && !data.success) return data.error.message;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Une erreur inattendue est survenue';
}

export const api = {
  auth: {
    login: (input: { email: string; password: string; rememberMe?: boolean }) =>
      unwrap(client.post<ApiResponse<{ accessToken: string }>>('/auth/login', input)),
    register: (input: { email: string; password: string; name: string }) =>
      unwrap(client.post<ApiResponse<{ accessToken: string }>>('/auth/register', input)),
    refresh: () => refreshAccessToken(),
    logout: () => client.post('/auth/logout'),
  },

  accounts: {
    list: () => unwrap(client.get<ApiResponse<Account[]>>('/accounts')),
    getById: (id: string) => unwrap(client.get<ApiResponse<Account>>(`/accounts/${id}`)),
    create: (input: CreateAccountInput) =>
      unwrap(client.post<ApiResponse<Account>>('/accounts', input)),
    update: (id: string, input: UpdateAccountInput) =>
      unwrap(client.patch<ApiResponse<Account>>(`/accounts/${id}`, input)),
    delete: (id: string) => client.delete(`/accounts/${id}`),
    balanceHistory: (id: string, days = 30) =>
      unwrap(
        client.get<ApiResponse<BalancePoint[]>>(`/accounts/${id}/balance-history`, {
          params: { days },
        }),
      ),
    syncRevolut: (id: string) => client.post(`/accounts/${id}/sync/revolut`),
    importCsv: (id: string, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return unwrap(
        client.post<ApiResponse<CsvImportResult>>(`/accounts/${id}/import/csv`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
      );
    },
  },

  categories: {
    list: () => unwrap(client.get<ApiResponse<Category[]>>('/categories')),
    create: (input: CreateCategoryInput) =>
      unwrap(client.post<ApiResponse<Category>>('/categories', input)),
    delete: (id: string) => client.delete(`/categories/${id}`),
  },

  transactions: {
    list: (query: ListTransactionsQuery = {}) =>
      unwrapWithMeta(
        client.get<ApiResponse<Transaction[]>>('/transactions', { params: query }),
      ),
    getById: (id: string) => unwrap(client.get<ApiResponse<Transaction>>(`/transactions/${id}`)),
    create: (input: CreateTransactionInput) =>
      unwrap(client.post<ApiResponse<Transaction>>('/transactions', input)),
    update: (id: string, input: UpdateTransactionInput) =>
      unwrap(client.patch<ApiResponse<Transaction>>(`/transactions/${id}`, input)),
    delete: (id: string) => client.delete(`/transactions/${id}`),
    stats: (query: { dateFrom?: string; dateTo?: string } = {}) =>
      unwrap(client.get<ApiResponse<TransactionStats>>('/transactions/stats', { params: query })),
  },

  budget: {
    current: () => unwrap(client.get<ApiResponse<BudgetCurrentView>>('/budget/current')),
    yearly: (year: number) =>
      unwrap(client.get<ApiResponse<BudgetYearlyMonth[]>>(`/budget/${year}`)),
    addLine: (input: { categoryId: string; plannedAmount: number }) =>
      unwrap(client.post<ApiResponse<unknown>>('/budget/lines', input)),
    updateLine: (id: string, plannedAmount: number) =>
      unwrap(client.patch<ApiResponse<unknown>>(`/budget/lines/${id}`, { plannedAmount })),
  },

  savings: {
    list: () => unwrap(client.get<ApiResponse<SavingsGoal[]>>('/savings')),
    getById: (id: string) => unwrap(client.get<ApiResponse<SavingsGoal>>(`/savings/${id}`)),
    create: (input: CreateSavingsGoalInput) =>
      unwrap(client.post<ApiResponse<SavingsGoal>>('/savings', input)),
    update: (id: string, input: UpdateSavingsGoalInput) =>
      unwrap(client.patch<ApiResponse<SavingsGoal>>(`/savings/${id}`, input)),
    delete: (id: string) => client.delete(`/savings/${id}`),
    deposit: (id: string, amount: number) =>
      unwrap(client.post<ApiResponse<DepositResult>>(`/savings/${id}/deposit`, { amount })),
    deposits: (id: string) =>
      unwrap(client.get<ApiResponse<SavingsDeposit[]>>(`/savings/${id}/deposits`)),
    milestones: (id: string) =>
      unwrap(client.get<ApiResponse<SavingsMilestonesView>>(`/savings/${id}/milestones`)),
  },

  investments: {
    list: () => unwrap(client.get<ApiResponse<InvestmentAccount[]>>('/investments')),
    getById: (id: string) =>
      unwrap(client.get<ApiResponse<InvestmentAccount>>(`/investments/${id}`)),
    create: (input: CreateInvestmentAccountInput) =>
      unwrap(client.post<ApiResponse<InvestmentAccount>>('/investments', input)),
    update: (id: string, input: UpdateInvestmentAccountInput) =>
      unwrap(client.patch<ApiResponse<InvestmentAccount>>(`/investments/${id}`, input)),
    delete: (id: string) => client.delete(`/investments/${id}`),
    addEntry: (id: string, input: CreateEntryInput) =>
      unwrap(client.post<ApiResponse<AddEntryResult>>(`/investments/${id}/entry`, input)),
    entries: (id: string) =>
      unwrap(client.get<ApiResponse<InvestmentEntry[]>>(`/investments/${id}/entries`)),
    projection: (id: string, query: ProjectionQuery = {}) =>
      unwrap(
        client.get<ApiResponse<ProjectionResult>>(`/investments/${id}/projection`, {
          params: query,
        }),
      ),
    milestones: () =>
      unwrap(client.get<ApiResponse<InvestmentMilestonesView>>('/investments/milestones')),
    quote: (symbol: string) =>
      unwrap(client.get<ApiResponse<StockQuote>>('/investments/quote', { params: { symbol } })),
  },

  crypto: {
    list: () => unwrap(client.get<ApiResponse<CryptoWallet[]>>('/crypto/wallets')),
    getById: (id: string) =>
      unwrap(client.get<ApiResponse<CryptoWallet>>(`/crypto/wallets/${id}`)),
    create: (input: CreateWalletInput) =>
      unwrap(client.post<ApiResponse<CryptoWallet>>('/crypto/wallets', input)),
    update: (id: string, input: UpdateWalletInput) =>
      unwrap(client.patch<ApiResponse<CryptoWallet>>(`/crypto/wallets/${id}`, input)),
    delete: (id: string) => client.delete(`/crypto/wallets/${id}`),
    sync: (id: string) => unwrap(client.post<ApiResponse<CryptoSnapshot>>(`/crypto/wallets/${id}/sync`)),
    history: (id: string) =>
      unwrap(client.get<ApiResponse<CryptoSnapshot[]>>(`/crypto/wallets/${id}/history`)),
    tokens: (id: string) =>
      unwrap(client.get<ApiResponse<WalletTokensResponse>>(`/crypto/wallets/${id}/tokens`)),
  },

  collectibles: {
    list: (type?: 'card' | 'sealed') =>
      unwrap(client.get<ApiResponse<CollectibleItem[]>>('/collectibles', { params: { type } })),
    getById: (id: string) =>
      unwrap(client.get<ApiResponse<CollectibleWithHistory>>(`/collectibles/${id}`)),
    create: (input: CreateCollectibleInput) =>
      unwrap(client.post<ApiResponse<CollectibleItem>>('/collectibles', input)),
    update: (id: string, input: UpdateCollectibleInput) =>
      unwrap(client.put<ApiResponse<CollectibleItem>>(`/collectibles/${id}`, input)),
    delete: (id: string) => client.delete(`/collectibles/${id}`),
    updatePrice: (id: string, input: ManualPriceUpdateInput) =>
      unwrap(
        client.put<ApiResponse<unknown>>(`/collectibles/${id}/price`, input),
      ),
    syncPrices: () => unwrap(client.post<ApiResponse<SyncPricesResult>>('/collectibles/sync-prices')),
    performance: (query: { sort?: 'best_performers' | 'worst_performers'; type?: 'card' | 'sealed' } = {}) =>
      unwrap(client.get<ApiResponse<CollectiblePerformance>>('/collectibles/performance', { params: query })),
    searchCard: (q: string, tcgType: TcgType = 'pokemon') =>
      unwrap(
        client.get<ApiResponse<CardSearchResult[]>>('/collectibles/search/card', {
          params: { q, tcgType },
        }),
      ),
    config: () => unwrap(client.get<ApiResponse<CollectiblesConfig>>('/collectibles/config')),
  },

  settings: {
    status: () => unwrap(client.get<ApiResponse<SettingsStatus>>('/settings')),
    update: (input: UpdateSettingsInput) =>
      unwrap(client.put<ApiResponse<SettingsStatus>>('/settings', input)),
    test: (input: TestSettingInput) =>
      unwrap(client.post<ApiResponse<TestSettingResult>>('/settings/test', input)),
  },

  exchangeRates: {
    latest: () => unwrap(client.get<ApiResponse<ExchangeRates>>('/exchange-rates/latest')),
  },

  credits: {
    list: () => unwrap(client.get<ApiResponse<Credit[]>>('/credits')),
    getById: (id: string) => unwrap(client.get<ApiResponse<Credit>>(`/credits/${id}`)),
    create: (input: CreateCreditInput) => unwrap(client.post<ApiResponse<Credit>>('/credits', input)),
    update: (id: string, input: UpdateCreditInput) =>
      unwrap(client.patch<ApiResponse<Credit>>(`/credits/${id}`, input)),
    delete: (id: string) => client.delete(`/credits/${id}`),
    recordPayment: (id: string, input: RecordCreditPaymentInput) =>
      unwrap(client.post<ApiResponse<{ payment: CreditPayment; credit: Credit }>>(
        `/credits/${id}/payments`,
        input,
      )),
    payments: (id: string) =>
      unwrap(client.get<ApiResponse<CreditPayment[]>>(`/credits/${id}/payments`)),
    simulation: (id: string, earlyRepaymentDate: string) =>
      unwrap(
        client.get<ApiResponse<CreditSimulation>>(`/credits/${id}/simulation`, {
          params: { earlyRepaymentDate },
        }),
      ),
  },

  realEstate: {
    list: () => unwrap(client.get<ApiResponse<RealEstateAsset[]>>('/real-estate')),
    getById: (id: string) => unwrap(client.get<ApiResponse<RealEstateAsset>>(`/real-estate/${id}`)),
    create: (input: CreateRealEstateAssetInput) =>
      unwrap(client.post<ApiResponse<RealEstateAsset>>('/real-estate', input)),
    update: (id: string, input: UpdateRealEstateAssetInput) =>
      unwrap(client.patch<ApiResponse<RealEstateAsset>>(`/real-estate/${id}`, input)),
    delete: (id: string) => client.delete(`/real-estate/${id}`),
    recordValue: (id: string, input: RecordRealEstateValueInput) =>
      unwrap(
        client.post<ApiResponse<RecordRealEstateValueResult>>(`/real-estate/${id}/value`, input),
      ),
    history: (id: string) =>
      unwrap(client.get<ApiResponse<RealEstateValuePoint[]>>(`/real-estate/${id}/history`)),
  },
};
