import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

export function useDashboardData() {
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: api.accounts.list });
  const savingsGoals = useQuery({ queryKey: ['savings'], queryFn: api.savings.list });
  const investments = useQuery({ queryKey: ['investments'], queryFn: api.investments.list });
  const budget = useQuery({ queryKey: ['budget', 'current'], queryFn: api.budget.current });
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories.list });
  const recentTransactions = useQuery({
    queryKey: ['transactions', { limit: 5 }],
    queryFn: () => api.transactions.list({ limit: 5 }),
  });
  const investmentMilestones = useQuery({
    queryKey: ['investments', 'milestones'],
    queryFn: api.investments.milestones,
  });

  const savingsTotal = (savingsGoals.data ?? []).reduce((sum, g) => sum + g.currentAmount, 0);
  const accountsTotal = (accounts.data ?? []).reduce((sum, a) => sum + a.balance, 0);
  const investmentsTotal = (investments.data ?? []).reduce((sum, i) => sum + i.currentValue, 0);

  // Date.now() here is a deliberate, harmless render-time read (no React
  // Compiler memoization in play) — just "is the most recent milestone
  // within the last week", recomputed on every render.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const recentlyReachedMilestone = (investmentMilestones.data?.reached ?? []).find(
    (m) => m.reachedAt && now - new Date(m.reachedAt).getTime() < 7 * 86_400_000,
  );

  return {
    accountsTotal,
    savingsTotal,
    investmentsTotal,
    budget: budget.data,
    categories: categories.data ?? [],
    recentTransactions: recentTransactions.data?.data ?? [],
    recentlyReachedMilestone,
    isLoading:
      accounts.isLoading || savingsGoals.isLoading || investments.isLoading || budget.isLoading,
  };
}
