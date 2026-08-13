import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { CreateAccountInput, PdfImportMappingItem, UpdateAccountInput } from '../../../types/api';

export const accountsKey = ['accounts'];

export function useAccounts() {
  return useQuery({ queryKey: accountsKey, queryFn: api.accounts.list });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: [...accountsKey, id],
    queryFn: () => api.accounts.getById(id),
    enabled: id !== '',
  });
}

export function useAccountBalanceHistory(id: string, days = 30) {
  return useQuery({
    queryKey: [...accountsKey, id, 'balance-history', days],
    queryFn: () => api.accounts.balanceHistory(id, days),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) => api.accounts.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKey }),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccountInput }) => api.accounts.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKey }),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.accounts.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKey }),
  });
}

export function useSyncRevolut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.accounts.syncRevolut(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKey }),
  });
}

export function useImportCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => api.accounts.importCsv(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function usePreviewPdfImport() {
  return useMutation({
    mutationFn: (file: File) => api.accounts.importPdfPreview(file),
  });
}

export function useConfirmPdfImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, mapping }: { file: File; mapping: PdfImportMappingItem[] }) =>
      api.accounts.importPdfConfirm(file, mapping),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
