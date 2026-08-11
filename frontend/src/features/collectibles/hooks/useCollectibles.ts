import { useQueries, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { forwardFill, lastNDays } from '../../../hooks/useNetWorthHistory';
import type {
  CollectibleItemType,
  CreateCollectibleInput,
  ManualPriceUpdateInput,
  TcgType,
  UpdateCollectibleInput,
} from '../../../types/api';

export const collectiblesKey = ['collectibles'];

export function useCollectibleItems(type?: CollectibleItemType) {
  return useQuery({
    queryKey: [...collectiblesKey, 'list', type],
    queryFn: () => api.collectibles.list(type),
  });
}

export function useCollectibleWithHistory(id: string) {
  return useQuery({ queryKey: [...collectiblesKey, id], queryFn: () => api.collectibles.getById(id), enabled: Boolean(id) });
}

export function useCollectiblePerformance(sort?: 'best_performers' | 'worst_performers', type?: CollectibleItemType) {
  return useQuery({
    queryKey: [...collectiblesKey, 'performance', sort, type],
    queryFn: () => api.collectibles.performance({ sort, type }),
  });
}

export function useCollectiblesConfig() {
  return useQuery({ queryKey: [...collectiblesKey, 'config'], queryFn: api.collectibles.config });
}

export function useSearchCard(q: string, tcgType: TcgType = 'pokemon') {
  return useQuery({
    queryKey: [...collectiblesKey, 'search', q, tcgType],
    queryFn: () => api.collectibles.searchCard(q, tcgType),
    enabled: q.length > 1 && tcgType === 'pokemon',
  });
}

export function useCreateCollectible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCollectibleInput) => api.collectibles.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectiblesKey }),
  });
}

export function useUpdatePrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ManualPriceUpdateInput }) =>
      api.collectibles.updatePrice(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectiblesKey }),
  });
}

export function useUpdatePriceSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      snapshotId,
      input,
    }: {
      id: string;
      snapshotId: string;
      input: ManualPriceUpdateInput;
    }) => api.collectibles.updatePriceSnapshot(id, snapshotId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectiblesKey }),
  });
}

export function useDeletePriceSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, snapshotId }: { id: string; snapshotId: string }) =>
      api.collectibles.deletePriceSnapshot(id, snapshotId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectiblesKey }),
  });
}

export function useUpdateCollectible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCollectibleInput }) =>
      api.collectibles.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectiblesKey }),
  });
}

export function useDeleteCollectible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.collectibles.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectiblesKey }),
  });
}

export function useSyncPrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.collectibles.syncPrices(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectiblesKey }),
  });
}

/** Aggregate collection value over time, composed client-side from each
 * item's price snapshot history (forward-filled) — see the net worth history
 * hook for the same pattern; no backend endpoint aggregates this directly. */
export function useCollectiblesValueHistory(days: number) {
  const items = useCollectibleItems();

  const histories = useQueries({
    queries: (items.data ?? []).map((item) => ({
      queryKey: [...collectiblesKey, item.id],
      queryFn: () => api.collectibles.getById(item.id),
      enabled: items.data !== undefined,
    })),
  });

  const dayGrid = lastNDays(days);
  const isLoading = items.isLoading || histories.some((q) => q.isLoading);

  const byItem = histories.map((q) =>
    forwardFill(
      (q.data?.history ?? [])
        .filter((s) => s.marketPriceEur !== null)
        .map((s) => ({ date: s.fetchedAt.slice(0, 10), value: s.marketPriceEur! })),
      dayGrid,
    ),
  );
  const total = dayGrid.map((_, i) => byItem.reduce((sum, series) => sum + (series[i] ?? 0), 0));

  return { days: dayGrid, total, isLoading };
}
