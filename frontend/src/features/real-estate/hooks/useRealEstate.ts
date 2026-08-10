import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type {
  CreateRealEstateAssetInput,
  RecordRealEstateValueInput,
  UpdateRealEstateAssetInput,
} from '../../../types/api';

export const realEstateKey = ['real-estate'];

export function useRealEstateAssets() {
  return useQuery({ queryKey: realEstateKey, queryFn: api.realEstate.list });
}

export function useRealEstateHistory(id: string) {
  return useQuery({
    queryKey: [...realEstateKey, id, 'history'],
    queryFn: () => api.realEstate.history(id),
    enabled: Boolean(id),
  });
}

export function useCreateRealEstateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRealEstateAssetInput) => api.realEstate.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: realEstateKey }),
  });
}

export function useUpdateRealEstateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRealEstateAssetInput }) =>
      api.realEstate.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: realEstateKey }),
  });
}

export function useDeleteRealEstateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.realEstate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: realEstateKey }),
  });
}

export function useRecordRealEstateValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecordRealEstateValueInput }) =>
      api.realEstate.recordValue(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: realEstateKey });
      queryClient.invalidateQueries({ queryKey: [...realEstateKey, variables.id, 'history'] });
    },
  });
}
