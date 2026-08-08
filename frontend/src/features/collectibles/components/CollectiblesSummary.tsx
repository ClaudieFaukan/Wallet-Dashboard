import { RefreshCw } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { AreaChartCard } from '../../../components/charts/AreaChartCard';
import { getErrorMessage } from '../../../lib/api';
import { formatCents, formatMonth, formatPercent } from '../../../lib/format';
import { bucketMonthly } from '../../../hooks/useNetWorthHistory';
import { useCollectiblePerformance, useCollectiblesValueHistory, useSyncPrices } from '../hooks/useCollectibles';

function PerformanceTable({ title, rows }: { title: string; rows: { id: string; name: string; gainLossPct: number | null }[] }) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-medium text-text-muted">{title}</h3>
      <ul className="space-y-2">
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
            <p className="text-xs text-text-muted">Total investi</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(totals?.totalInvested ?? 0)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Valeur actuelle</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(totals?.totalCurrentValue ?? 0)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Gain global</p>
            <p className={`mt-1 font-mono text-lg font-semibold ${(totals?.totalGainLossPct ?? 0) >= 0 ? 'text-accent-2' : 'text-accent-3'}`}>
              {totals ? formatPercent(totals.totalGainLossPct) : '—'}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Items</p>
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

      <AreaChartCard title="Valeur de la collection" data={monthly} formatValue={(v) => formatCents(v)} />

      <div className="grid grid-cols-2 gap-4">
        <PerformanceTable title="Top 5 performers" rows={best?.items.slice(0, 5) ?? []} />
        <PerformanceTable title="Flop 5" rows={worst?.items.slice(0, 5) ?? []} />
      </div>
    </div>
  );
}
