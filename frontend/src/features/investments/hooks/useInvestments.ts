import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type {
  CreateEntryInput,
  CreateInvestmentAccountInput,
  CreateInvestmentGoalInput,
  ProjectionQuery,
  UpdateEntryInput,
  UpdateInvestmentAccountInput,
  UpdateInvestmentGoalInput,
} from '../../../types/api';

export const investmentsKey = ['investments'];

export function useInvestmentAccounts() {
  return useQuery({ queryKey: investmentsKey, queryFn: api.investments.list });
}

export function useInvestmentAccount(id: string) {
  return useQuery({ queryKey: [...investmentsKey, id], queryFn: () => api.investments.getById(id) });
}

export function useInvestmentEntries(id: string) {
  return useQuery({ queryKey: [...investmentsKey, id, 'entries'], queryFn: () => api.investments.entries(id) });
}

export function useInvestmentMilestones() {
  return useQuery({ queryKey: [...investmentsKey, 'milestones'], queryFn: api.investments.milestones });
}

export function useProjection(id: string, query: ProjectionQuery) {
  return useQuery({
    queryKey: [...investmentsKey, id, 'projection', query],
    queryFn: () => api.investments.projection(id, query),
    enabled: Boolean(id),
  });
}

export function useCreateInvestmentAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvestmentAccountInput) => api.investments.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: investmentsKey }),
  });
}

export function useUpdateInvestmentAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInvestmentAccountInput }) =>
      api.investments.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: investmentsKey }),
  });
}

export function useDeleteInvestmentAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.investments.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: investmentsKey }),
  });
}

export function useAddEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateEntryInput }) => api.investments.addEntry(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: investmentsKey });
      queryClient.invalidateQueries({ queryKey: [...investmentsKey, variables.id, 'entries'] });
    },
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, entryId, input }: { id: string; entryId: string; input: UpdateEntryInput }) =>
      api.investments.updateEntry(id, entryId, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: investmentsKey });
      queryClient.invalidateQueries({ queryKey: [...investmentsKey, variables.id, 'entries'] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, entryId }: { id: string; entryId: string }) =>
      api.investments.deleteEntry(id, entryId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: investmentsKey });
      queryClient.invalidateQueries({ queryKey: [...investmentsKey, variables.id, 'entries'] });
    },
  });
}

export function useInvestmentGoals() {
  return useQuery({ queryKey: [...investmentsKey, 'goals'], queryFn: api.investments.goals });
}

export function useCreateInvestmentGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvestmentGoalInput) => api.investments.createGoal(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...investmentsKey, 'goals'] }),
  });
}

export function useUpdateInvestmentGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInvestmentGoalInput }) =>
      api.investments.updateGoal(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...investmentsKey, 'goals'] }),
  });
}

export function useDeleteInvestmentGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.investments.deleteGoal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...investmentsKey, 'goals'] }),
  });
}

export function useStockQuote(symbol: string | null) {
  return useQuery({
    queryKey: ['stock-quote', symbol],
    queryFn: () => api.investments.quote(symbol as string),
    enabled: Boolean(symbol),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

// One cached quote query per distinct ticker held across an account's entries — powers the
// "Positions" table and daily trend on InvestmentDetailPage.
export function useStockQuotes(symbols: string[]) {
  return useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: ['stock-quote', symbol],
      queryFn: () => api.investments.quote(symbol),
      staleTime: 60 * 60 * 1000,
      retry: false,
    })),
  });
}
