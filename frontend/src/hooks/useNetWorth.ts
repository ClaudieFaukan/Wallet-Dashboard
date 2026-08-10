import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { usdCentsToEurCents } from '../lib/constants';

/** Latest snapshot value (EUR cents) per crypto wallet — wallets don't carry
 * a value column themselves, only their sync snapshots do. */
export function useCryptoLatestValues() {
  const wallets = useQuery({ queryKey: ['crypto', 'wallets'], queryFn: api.crypto.list });

  const histories = useQueries({
    queries: (wallets.data ?? []).map((wallet) => ({
      queryKey: ['crypto', 'wallets', wallet.id, 'history'],
      queryFn: () => api.crypto.history(wallet.id),
      enabled: wallets.data !== undefined,
    })),
  });

  const isLoading = wallets.isLoading || histories.some((h) => h.isLoading);
  const total = histories.reduce((sum, h) => {
    const latest = h.data?.[0];
    return sum + (latest ? usdCentsToEurCents(latest.totalValueUsd) : 0);
  }, 0);

  return { wallets: wallets.data ?? [], histories, total, isLoading };
}

/** Sums comptes + investissements + crypto + collectibles + immobilier into a
 * gross net worth total in EUR cents (matches Finary's default "Patrimoine
 * brut" view — assets only). Crédits are exposed separately as
 * `liabilitiesTotal` / `netTotal` rather than subtracted from `total`, so a
 * future "Patrimoine net" toggle can reuse them without recomputing. */
export function useNetWorth() {
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: api.accounts.list });
  const investments = useQuery({ queryKey: ['investments'], queryFn: api.investments.list });
  const collectibles = useQuery({
    queryKey: ['collectibles', 'performance'],
    queryFn: () => api.collectibles.performance(),
  });
  const realEstate = useQuery({ queryKey: ['real-estate'], queryFn: api.realEstate.list });
  const credits = useQuery({ queryKey: ['credits'], queryFn: api.credits.list });
  const crypto = useCryptoLatestValues();

  const accountsTotal = (accounts.data ?? []).reduce((sum, a) => sum + a.balance, 0);
  const investmentsTotal = (investments.data ?? []).reduce((sum, i) => sum + i.currentValue, 0);
  const collectiblesTotal = collectibles.data?.totals.totalCurrentValue ?? 0;
  const realEstateTotal = (realEstate.data ?? []).reduce((sum, r) => sum + r.currentValue, 0);
  const liabilitiesTotal = (credits.data ?? []).reduce((sum, c) => sum + c.remainingAmount, 0);

  const isLoading =
    accounts.isLoading ||
    investments.isLoading ||
    collectibles.isLoading ||
    realEstate.isLoading ||
    credits.isLoading ||
    crypto.isLoading;

  const total = accountsTotal + investmentsTotal + crypto.total + collectiblesTotal + realEstateTotal;

  return {
    total,
    netTotal: total - liabilitiesTotal,
    liabilitiesTotal,
    breakdown: {
      accounts: accountsTotal,
      investments: investmentsTotal,
      crypto: crypto.total,
      collectibles: collectiblesTotal,
      realEstate: realEstateTotal,
      credits: liabilitiesTotal,
    },
    isLoading,
  };
}
