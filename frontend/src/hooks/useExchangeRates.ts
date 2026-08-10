import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/** Rates only change daily server-side (see backend exchange-rates cron) — no need to refetch more often. */
export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates'],
    queryFn: api.exchangeRates.latest,
    staleTime: 60 * 60 * 1000,
  });
}
