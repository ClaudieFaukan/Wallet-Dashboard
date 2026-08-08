import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { CreateWalletInput } from '../../../types/api';

export const cryptoKey = ['crypto', 'wallets'];

export function useCryptoWallets() {
  return useQuery({ queryKey: cryptoKey, queryFn: api.crypto.list });
}

export function useCryptoHistory(id: string) {
  return useQuery({ queryKey: [...cryptoKey, id, 'history'], queryFn: () => api.crypto.history(id) });
}

export function useCreateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWalletInput) => api.crypto.create(input),
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
