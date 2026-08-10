import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { CreateCreditInput, RecordCreditPaymentInput, UpdateCreditInput } from '../../../types/api';

export const creditsKey = ['credits'];

export function useCredits() {
  return useQuery({ queryKey: creditsKey, queryFn: api.credits.list });
}

export function useCreateCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCreditInput) => api.credits.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: creditsKey }),
  });
}

export function useUpdateCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCreditInput }) =>
      api.credits.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: creditsKey }),
  });
}

export function useDeleteCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.credits.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: creditsKey }),
  });
}

export function useRecordCreditPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecordCreditPaymentInput }) =>
      api.credits.recordPayment(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: creditsKey }),
  });
}

export function useCreditSimulation(id: string, earlyRepaymentDate: string) {
  return useQuery({
    queryKey: [...creditsKey, id, 'simulation', earlyRepaymentDate],
    queryFn: () => api.credits.simulation(id, earlyRepaymentDate),
    enabled: Boolean(id && earlyRepaymentDate),
  });
}
