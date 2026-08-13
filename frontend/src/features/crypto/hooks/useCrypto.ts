import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type {
  CreateCostEntryInput,
  CreateWalletInput,
  UpdateCostEntryInput,
  UpdateWalletInput,
} from '../../../types/api';

export const cryptoKey = ['crypto', 'wallets'];

export function useCryptoWallets() {
  return useQuery({ queryKey: cryptoKey, queryFn: api.crypto.list });
}

export function useCryptoWallet(id: string) {
  return useQuery({ queryKey: [...cryptoKey, id], queryFn: () => api.crypto.getById(id) });
}

export function useCryptoHistory(id: string) {
  return useQuery({ queryKey: [...cryptoKey, id, 'history'], queryFn: () => api.crypto.history(id) });
}

export function useWalletTokens(id: string) {
  return useQuery({ queryKey: [...cryptoKey, id, 'tokens'], queryFn: () => api.crypto.tokens(id) });
}

export function useCreateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWalletInput) => api.crypto.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cryptoKey }),
  });
}

export function useUpdateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWalletInput }) => api.crypto.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cryptoKey }),
  });
}

export function useDeleteWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.crypto.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cryptoKey }),
  });
}

export function useSyncWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.crypto.sync(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: cryptoKey });
      queryClient.invalidateQueries({ queryKey: [...cryptoKey, id, 'history'] });
    },
  });
}

export function useCostEntries(walletId: string) {
  return useQuery({
    queryKey: [...cryptoKey, walletId, 'cost-entries'],
    queryFn: () => api.crypto.listCostEntries(walletId),
  });
}

export function useAddCostEntry(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCostEntryInput) => api.crypto.addCostEntry(walletId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...cryptoKey, walletId, 'cost-entries'] }),
  });
}

export function useUpdateCostEntry(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, input }: { entryId: string; input: UpdateCostEntryInput }) =>
      api.crypto.updateCostEntry(walletId, entryId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...cryptoKey, walletId, 'cost-entries'] }),
  });
}

export function useDeleteCostEntry(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => api.crypto.deleteCostEntry(walletId, entryId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...cryptoKey, walletId, 'cost-entries'] }),
  });
}
