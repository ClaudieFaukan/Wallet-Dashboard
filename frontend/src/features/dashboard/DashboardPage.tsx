import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Variation } from '../../components/ui/Variation';
import { AreaChartCard } from '../../components/charts/AreaChartCard';
import { DonutChartCard } from '../../components/charts/DonutChartCard';
import { useNetWorth } from '../../hooks/useNetWorth';
import { bucketMonthly, useNetWorthHistory } from '../../hooks/useNetWorthHistory';
import { formatCents, formatDate, formatMonth } from '../../lib/format';
import { useDashboardData } from './hooks/useDashboardData';

type PeriodKey = '7J' | '1M' | '3M' | '6M' | 'YTD' | '1A' | 'TOUT';

const periodTabs: { value: PeriodKey; label: string }[] = [
  { value: '7J', label: '7J' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1A', label: '1A' },
  { value: 'TOUT', label: 'TOUT' },
];

export function DashboardPage() {
  const [period, setPeriod] = useState<PeriodKey>('1A');
  const netWorth = useNetWorth();
  // eslint-disable-next-line react-hooks/purity -- harmless render-time read, see useDashboardData
  const now = Date.now();
  const daysSinceJan1 = Math.max(1, Math.ceil((now - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86_400_000));
  const periodDays: Record<PeriodKey, number> = {
    '7J': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    YTD: daysSinceJan1,
    '1A': 365,
    TOUT: 1095,
  };
  const days = periodDays[period];
  const history = useNetWorthHistory(days);
  const {
    accountsTotal,
    savingsTotal,
    investmentsTotal,
    budget,
    recentTransactions,
    categories,
    recentlyReachedMilestone,
  } = useDashboardData();

  const chartData =
    days <= 180
      ? history.days.map((d, i) => ({
          label: formatDate(d, { day: '2-digit', month: '2-digit' }),
          value: history.total[i] ?? 0,
        }))
      : bucketMonthly(history.days, history.total).map((p) => ({
          label: formatMonth(p.month),
          value: p.value,
        }));

  const first = history.total[0] ?? 0;
  const last = history.total[history.total.length - 1] ?? netWorth.total;
  const delta = last - first;
  const deltaPercent = first !== 0 ? (delta / first) * 100 : 0;
  const lastDay = history.days[history.days.length - 1];

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? 'Sans catégorie';

  const donutData = (budget?.lines ?? []).map((l) => ({
    label: l.categoryName,
    value: l.actualAmount > 0 ? l.actualAmount : 0,
  }));

  return (
    <div>
      <Header title="Synthèse" />
      <div className="space-y-6 p-8">
        {recentlyReachedMilestone && (
          <div className="flex items-center gap-2 rounded-lg border border-accent-2/30 bg-accent-2/10 px-4 py-2 text-sm text-accent-2">
            <Sparkles size={16} />
            Jalon investissement franchi : {formatCents(recentlyReachedMilestone.amount)} 🎉
          </div>
        )}

        <AreaChartCard
          header={
            <>
              {lastDay && <p className="text-sm text-text-secondary">{formatDate(lastDay)}</p>}
              <p className="mt-1 font-mono text-hero font-bold tracking-[-0.03em] text-text-primary">
                {netWorth.isLoading ? '—' : formatCents(netWorth.total)}
              </p>
              {!history.isLoading && (
                <div className="mt-2">
                  <Variation amountCents={delta} percent={deltaPercent} />
                </div>
              )}
            </>
          }
          actions={<Tabs tabs={periodTabs} value={period} onChange={setPeriod} />}
          data={chartData}
          formatValue={(v) => formatCents(v)}
          height={280}
        />

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <p className="text-sm text-text-secondary">Solde comptes</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(accountsTotal)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-text-secondary">Épargne totale</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(savingsTotal)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-text-secondary">Investissements</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(investmentsTotal)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-text-secondary">Crypto</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(netWorth.breakdown.crypto)}
            </p>
          </Card>
        </div>

        <DonutChartCard
          title="Budget du mois — dépenses par catégorie"
          data={donutData}
          formatValue={(v) => formatCents(v)}
        />

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-muted">Dernières transactions</h3>
            <Link to="/transactions" className="text-xs text-accent-gold hover:underline">
              Voir tout
            </Link>
          </div>
          <ul className="divide-y divide-border/50">
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
