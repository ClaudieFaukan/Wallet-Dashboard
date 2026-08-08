import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { usdCentsToEurCents } from '../lib/constants';
import type { Account, CollectibleWithHistory, InvestmentAccount } from '../types/api';

interface TimePoint {
  date: string; // YYYY-MM-DD
  value: number;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Forward-fills a sparse series of {date, value} points onto every day in
 * `days` (oldest first), carrying the last known value forward and using 0
 * before the first known point. */
function forwardFill(points: TimePoint[], days: string[]): number[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  let idx = 0;
  let current = 0;
  return days.map((day) => {
    while (idx < sorted.length && sorted[idx]!.date <= day) {
      current = sorted[idx]!.value;
      idx++;
    }
    return current;
  });
}

/** Reduces a daily {days, values} series to one point per month (last known
 * value of each month), for a 12-month overview chart. */
export function bucketMonthly(days: string[], values: number[]): { month: string; value: number }[] {
  const byMonth = new Map<string, number>();
  days.forEach((day, i) => {
    byMonth.set(day.slice(0, 7), values[i] ?? 0);
  });
  return Array.from(byMonth.entries()).map(([month, value]) => ({ month, value }));
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    days.push(new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10));
  }
  return days;
}

/** Best-effort net worth history composed client-side from four sources with
 * very different granularity: accounts have a true daily reconstruction,
 * investments/crypto/collectibles only have sparse event points that get
 * forward-filled onto the same day grid. See project plan for the rationale
 * — no backend endpoint aggregates all four into one series. */
export function useNetWorthHistory(days: number) {
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: api.accounts.list });
  const investments = useQuery({ queryKey: ['investments'], queryFn: api.investments.list });
  const collectibleItems = useQuery({
    queryKey: ['collectibles', 'list'],
    queryFn: () => api.collectibles.list(),
  });
  const cryptoWallets = useQuery({ queryKey: ['crypto', 'wallets'], queryFn: api.crypto.list });

  const accountHistories = useQueries({
    queries: (accounts.data ?? []).map((a: Account) => ({
      queryKey: ['accounts', a.id, 'balance-history', days],
      queryFn: () => api.accounts.balanceHistory(a.id, days),
      enabled: accounts.data !== undefined,
    })),
  });

  const investmentEntries = useQueries({
    queries: (investments.data ?? []).map((acc: InvestmentAccount) => ({
      queryKey: ['investments', acc.id, 'entries'],
      queryFn: () => api.investments.entries(acc.id),
      enabled: investments.data !== undefined,
    })),
  });

  const cryptoHistories = useQueries({
    queries: (cryptoWallets.data ?? []).map((w) => ({
      queryKey: ['crypto', 'wallets', w.id, 'history'],
      queryFn: () => api.crypto.history(w.id),
      enabled: cryptoWallets.data !== undefined,
    })),
  });

  const collectibleHistories = useQueries({
    queries: (collectibleItems.data ?? []).map((item) => ({
      queryKey: ['collectibles', item.id],
      queryFn: (): Promise<CollectibleWithHistory> => api.collectibles.getById(item.id),
      enabled: collectibleItems.data !== undefined,
    })),
  });

  const isLoading =
    accounts.isLoading ||
    investments.isLoading ||
    collectibleItems.isLoading ||
    cryptoWallets.isLoading ||
    accountHistories.some((q) => q.isLoading) ||
    investmentEntries.some((q) => q.isLoading) ||
    cryptoHistories.some((q) => q.isLoading) ||
    collectibleHistories.some((q) => q.isLoading);

  const dayGrid = lastNDays(days);

  const accountsSeries = dayGrid.map((_, i) =>
    accountHistories.reduce((sum, q) => sum + (q.data?.[i]?.balance ?? 0), 0),
  );

  const investmentsByAccount = investmentEntries.map((q) =>
    forwardFill(
      (q.data ?? []).map((e) => ({ date: dayKey(e.date), value: e.portfolioValue })),
      dayGrid,
    ),
  );
  const investmentsSeries = dayGrid.map((_, i) =>
    investmentsByAccount.reduce((sum, series) => sum + (series[i] ?? 0), 0),
  );

  const cryptoByWallet = cryptoHistories.map((q) =>
    forwardFill(
      (q.data ?? []).map((s) => ({ date: dayKey(s.fetchedAt), value: usdCentsToEurCents(s.totalValueUsd) })),
      dayGrid,
    ),
  );
  const cryptoSeries = dayGrid.map((_, i) =>
    cryptoByWallet.reduce((sum, series) => sum + (series[i] ?? 0), 0),
  );

  const collectiblesByItem = collectibleHistories.map((q) =>
    forwardFill(
      (q.data?.history ?? [])
        .filter((s) => s.marketPriceEur !== null)
        .map((s) => ({ date: dayKey(s.fetchedAt), value: s.marketPriceEur! })),
      dayGrid,
    ),
  );
  const collectiblesSeries = dayGrid.map((_, i) =>
    collectiblesByItem.reduce((sum, series) => sum + (series[i] ?? 0), 0),
  );

  const total = dayGrid.map(
    (_, i) =>
      (accountsSeries[i] ?? 0) +
      (investmentsSeries[i] ?? 0) +
      (cryptoSeries[i] ?? 0) +
      (collectiblesSeries[i] ?? 0),
  );

  return {
    days: dayGrid,
    total,
    isLoading,
  };
}
