import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Tabs } from '../../../components/ui/Tabs';
import { useToast } from '../../../components/ui/Toast';
import { AreaChartCard } from '../../../components/charts/AreaChartCard';
import { getErrorMessage } from '../../../lib/api';
import { formatMonth, formatPercent } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { bucketMonthly } from '../../../hooks/useNetWorthHistory';
import { useCollectiblePerformance, useCollectiblesValueHistory, useSyncPrices } from '../hooks/useCollectibles';

type PerformanceRow = { id: string; name: string; gainLossPct: number | null };

function PerformanceTabsCard({ best, worst }: { best: PerformanceRow[]; worst: PerformanceRow[] }) {
  const [tab, setTab] = useState<'best' | 'worst'>('best');
  const rows = tab === 'best' ? best : worst;

  return (
    <Card className="col-span-12 lg:col-span-4">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'best', label: 'Top 5' },
          { value: 'worst', label: 'Flop 5' },
        ]}
      />
      <ul className="mt-3 space-y-2">
        {rows.length === 0 && <li className="text-sm text-text-muted">Pas assez de données</li>}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between text-sm">
            <span className="text-text-primary">{r.name}</span>
            {r.gainLossPct !== null && (
              <Badge variant={r.gainLossPct >= 0 ? 'success' : 'danger'}>{formatPercent(r.gainLossPct)}</Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CollectiblesSummary() {
  const { data: performance } = useCollectiblePerformance();
  const { data: best } = useCollectiblePerformance('best_performers');
  const { data: worst } = useCollectiblePerformance('worst_performers');
  const history = useCollectiblesValueHistory(365);
  const syncPrices = useSyncPrices();
  const toast = useToast();
  const { formatCents } = useFormatCurrency();

  const monthly = bucketMonthly(history.days, history.total).map((p) => ({
    label: formatMonth(p.month),
    value: p.value,
  }));

  const totals = performance?.totals;
  const itemCount = performance?.items.length ?? 0;

  function handleSync() {
    syncPrices.mutate(undefined, {
      onSuccess: (result) => toast.success(`${result.synced} prix synchronisés, ${result.skipped} ignorés`),
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid flex-1 grid-cols-4 gap-4">
          <Card>
            <p className="text-sm text-text-secondary">Total investi</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(totals?.totalInvested ?? 0)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-text-secondary">Valeur actuelle</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(totals?.totalCurrentValue ?? 0)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-text-secondary">Gain global</p>
            <p className={`mt-1 font-mono text-lg font-semibold ${(totals?.totalGainLossPct ?? 0) >= 0 ? 'text-accent-2' : 'text-accent-3'}`}>
              {totals ? formatPercent(totals.totalGainLossPct) : '—'}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-text-secondary">Items</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">{itemCount}</p>
          </Card>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<RefreshCw size={14} />}
          className="ml-4"
          onClick={handleSync}
          disabled={syncPrices.isPending}
        >
          {syncPrices.isPending ? 'Sync…' : 'Sync prix'}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <AreaChartCard
          title="Valeur de la collection"
          data={monthly}
          formatValue={(v) => formatCents(v)}
          height={150}
          className="col-span-12 lg:col-span-8"
        />
        <PerformanceTabsCard best={best?.items.slice(0, 5) ?? []} worst={worst?.items.slice(0, 5) ?? []} />
      </div>
    </div>
  );
}
