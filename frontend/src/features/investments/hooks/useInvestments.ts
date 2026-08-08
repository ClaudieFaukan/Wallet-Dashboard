import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { CreateEntryInput, CreateInvestmentAccountInput, ProjectionQuery } from '../../../types/api';

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
