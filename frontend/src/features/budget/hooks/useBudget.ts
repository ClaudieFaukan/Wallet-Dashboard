import { useQueries, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

export function useBudgetCurrent() {
  return useQuery({ queryKey: ['budget', 'current'], queryFn: api.budget.current });
}

export function useBudgetYearly(year: number) {
  return useQuery({ queryKey: ['budget', 'yearly', year], queryFn: () => api.budget.yearly(year) });
}

export function useAddBudgetLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { categoryId: string; plannedAmount: number }) => api.budget.addLine(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget'] }),
  });
}

export function useUpdateBudgetLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, plannedAmount }: { id: string; plannedAmount: number }) =>
      api.budget.updateLine(id, plannedAmount),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget'] }),
  });
}

function monthBounds(year: number, monthIndex: number): { dateFrom: string; dateTo: string } {
  const dateFrom = new Date(Date.UTC(year, monthIndex, 1)).toISOString();
  const dateTo = new Date(Date.UTC(year, monthIndex + 1, 1)).toISOString();
  return { dateFrom, dateTo };
}

/** Category × month spend matrix for the annual heatmap — no single backend
 * endpoint returns this, so it's composed from 12 `transactions/stats` calls
 * (one per month), each already aggregated `byCategory` server-side. */
export function useCategoryMonthMatrix(year: number) {
  const queries = useQueries({
    queries: Array.from({ length: 12 }, (_, i) => {
      const { dateFrom, dateTo } = monthBounds(year, i);
      return {
        queryKey: ['transactions', 'stats', year, i],
        queryFn: () => api.transactions.stats({ dateFrom, dateTo }),
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const byMonth = queries.map((q) => q.data?.byCategory ?? []);

  return { byMonth, isLoading };
}
