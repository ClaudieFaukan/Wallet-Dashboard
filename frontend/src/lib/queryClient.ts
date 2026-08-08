import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (isAxiosError(error) && [401, 404].includes(error.response?.status ?? 0)) return false;
        return failureCount < 2;
      },
    },
  },
});
