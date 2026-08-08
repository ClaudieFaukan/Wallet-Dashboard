import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { AreaChartCard } from '../../components/charts/AreaChartCard';
import { DonutChartCard } from '../../components/charts/DonutChartCard';
import { SparklineChart } from '../../components/charts/SparklineChart';
import { useNetWorth } from '../../hooks/useNetWorth';
import { bucketMonthly, useNetWorthHistory } from '../../hooks/useNetWorthHistory';
import { formatCents, formatDate, formatMonth } from '../../lib/format';
import { useDashboardData } from './hooks/useDashboardData';

export function DashboardPage() {
  const netWorth = useNetWorth();
  const history30d = useNetWorthHistory(30);
  const history12m = useNetWorthHistory(365);
  const {
    accountsTotal,
    savingsTotal,
    investmentsTotal,
    budget,
    categories,
    recentTransactions,
    recentlyReachedMilestone,
  } = useDashboardData();

  const monthly = bucketMonthly(history12m.days, history12m.total).map((p) => ({
    label: formatMonth(p.month),
    value: p.value,
  }));

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? 'Sans catégorie';

  const donutData = (budget?.lines ?? []).map((l) => ({
    label: l.categoryName,
    value: l.actualAmount > 0 ? l.actualAmount : 0,
  }));

  return (
    <div>
      <Header title="Dashboard" />
      <div className="space-y-6 p-8">
        {recentlyReachedMilestone && (
          <div className="flex animate-pulse items-center gap-2 rounded-lg border border-accent-2/30 bg-accent-2/10 px-4 py-2 text-sm text-accent-2">
            <Sparkles size={16} />
            Jalon investissement franchi : {formatCents(recentlyReachedMilestone.amount)} 🎉
          </div>
        )}

        <Card>
          <p className="text-xs uppercase tracking-wide text-text-muted">Patrimoine net total</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-text-primary">
            {netWorth.isLoading ? '—' : formatCents(netWorth.total)}
          </p>
          <div className="mt-3">
            {!history30d.isLoading && <SparklineChart data={history30d.total} height={56} />}
          </div>
        </Card>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-text-muted">Solde comptes</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(accountsTotal)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Épargne totale</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(savingsTotal)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Investissements</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(investmentsTotal)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Crypto</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(netWorth.breakdown.crypto)}
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <AreaChartCard
              title="Patrimoine net — 12 derniers mois"
              data={monthly}
              formatValue={(v) => formatCents(v)}
            />
          </div>
          <DonutChartCard
            title="Budget du mois — dépenses par catégorie"
            data={donutData}
            formatValue={(v) => formatCents(v)}
          />
        </div>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-muted">Dernières transactions</h3>
            <Link to="/transactions" className="text-xs text-accent hover:underline">
              Voir tout
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {recentTransactions.length === 0 && (
              <li className="py-3 text-sm text-text-muted">Aucune transaction</li>
            )}
            {recentTransactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="text-text-primary">{t.description ?? categoryName(t.categoryId)}</p>
                  <p className="text-xs text-text-muted">{formatDate(t.date)}</p>
                </div>
                <Badge variant={t.amount >= 0 ? 'success' : 'danger'}>{formatCents(t.amount)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
