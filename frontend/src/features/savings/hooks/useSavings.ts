import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { CreateSavingsGoalInput, UpdateSavingsGoalInput } from '../../../types/api';

export const savingsKey = ['savings'];

export function useSavingsGoals() {
  return useQuery({ queryKey: savingsKey, queryFn: api.savings.list });
}

export function useSavingsDeposits(goalId: string) {
  return useQuery({ queryKey: [...savingsKey, goalId, 'deposits'], queryFn: () => api.savings.deposits(goalId) });
}

export function useCreateSavingsGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSavingsGoalInput) => api.savings.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: savingsKey }),
  });
}

export function useUpdateSavingsGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSavingsGoalInput }) =>
      api.savings.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: savingsKey }),
  });
}

export function useDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.savings.deposit(id, amount),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: savingsKey });
      queryClient.invalidateQueries({ queryKey: [...savingsKey, variables.id, 'deposits'] });
    },
  });
}
