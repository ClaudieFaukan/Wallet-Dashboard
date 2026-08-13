import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { CreateCreditInput, RecordCreditPaymentInput, UpdateCreditInput } from '../../../types/api';

export const creditsKey = ['credits'];

export function useCredits() {
  return useQuery({ queryKey: creditsKey, queryFn: api.credits.list });
}

export function useCredit(id: string) {
  return useQuery({
    queryKey: [...creditsKey, id],
    queryFn: () => api.credits.getById(id),
    enabled: id !== '',
  });
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

export function useCreditPayments(id: string) {
  return useQuery({
    queryKey: [...creditsKey, id, 'payments'],
    queryFn: () => api.credits.payments(id),
    enabled: id !== '',
  });
}

export function useSuggestedPayments(id: string) {
  return useQuery({
    queryKey: [...creditsKey, id, 'suggested-payments'],
    queryFn: () => api.credits.suggestedPayments(id),
    enabled: id !== '',
  });
}

export function useLinkPayment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) => api.credits.linkPayment(id, transactionId),
    // Invalidating the shared 'credits' prefix covers the list, this credit's detail, its
    // payment history and its suggestions in one go (React Query matches by prefix).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: creditsKey }),
  });
}

export function useUnlinkPayment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => api.credits.unlinkPayment(id, paymentId),
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
