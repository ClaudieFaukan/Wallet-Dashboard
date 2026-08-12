import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { TestSettingInput, UpdateSettingsInput } from '../../../types/api';

const settingsKey = ['settings'];

export function useSettingsStatus() {
  return useQuery({ queryKey: settingsKey, queryFn: api.settings.status });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => api.settings.update(input),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKey, data);
    },
  });
}

export function useTestSetting() {
  return useMutation({
    mutationFn: (input: TestSettingInput) => api.settings.test(input),
  });
}

export function useResetDevData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.settings.devReset(),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
