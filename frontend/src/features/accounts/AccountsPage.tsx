import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { Variation } from '../../components/ui/Variation';
import { DonutChartCard } from '../../components/charts/DonutChartCard';
import { otherColor } from '../../components/charts/chartTheme';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { usePatrimoineRows } from '../../hooks/usePatrimoineRows';
import { AssetTable } from './components/AssetTable';
import { CreateAccountDrawer } from './components/CreateAccountDrawer';

const DONUT_TOP_N = 8;

export function AccountsPage() {
  const { rows, assetsTotal, assetsYtdVariation, assetsYtdVariationPct, isLoading } = usePatrimoineRows();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { formatCents } = useFormatCurrency();

  const assetRows = [...rows]
    .filter((r) => !r.isLiability && r.value > 0)
    .sort((a, b) => b.value - a.value);
  const top = assetRows.slice(0, DONUT_TOP_N);
  const rest = assetRows.slice(DONUT_TOP_N);
  const restTotal = rest.reduce((sum, r) => sum + r.value, 0);
  const donutData = [
    ...top.map((r) => ({ label: r.name, value: r.value })),
    ...(restTotal > 0 ? [{ label: 'Autre', value: restTotal, color: otherColor }] : []),
  ];

  return (
    <div>
      <Header
        title="Patrimoine"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Nouveau compte
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        {isLoading && (
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="col-span-2 h-64" />
            <Skeleton className="h-64" />
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <p className="text-sm text-text-muted">Aucun actif pour l'instant.</p>
        )}

        {!isLoading && rows.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="col-span-2 flex flex-col justify-center">
              <p className="text-sm text-text-secondary">Patrimoine brut</p>
              <p className="mt-2 font-mono text-hero font-bold tracking-[-0.03em] text-text-primary">
                {formatCents(assetsTotal)}
              </p>
              {assetsYtdVariation !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <Variation amountCents={assetsYtdVariation} percent={assetsYtdVariationPct} />
                  <span className="text-xs text-text-muted">Variation année à date</span>
                </div>
              )}
            </Card>
            <DonutChartCard title="Répartition" data={donutData} formatValue={(v) => formatCents(v)} />
          </div>
        )}

        {!isLoading && rows.length > 0 && <AssetTable rows={rows} isLoading={isLoading} />}
      </div>
      <CreateAccountDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
