import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatPercent } from '../../lib/format';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { RealEstateAssetCard } from './components/RealEstateAssetCard';
import { CreateRealEstateDrawer } from './components/CreateRealEstateDrawer';
import { useRealEstateAssets } from './hooks/useRealEstate';

export function RealEstatePage() {
  const { data: assets, isLoading } = useRealEstateAssets();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { formatCents } = useFormatCurrency();

  const totalValue = (assets ?? []).reduce((sum, a) => sum + a.currentValue, 0);
  const totalAnnualIncome = (assets ?? []).reduce((sum, a) => sum + a.monthlyIncome * 12, 0);
  const grossYield = totalValue > 0 ? (totalAnnualIncome / totalValue) * 100 : 0;

  return (
    <div>
      <Header
        title="Immobilier"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Nouvel actif
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        {!isLoading && assets && assets.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <p className="text-sm text-text-secondary">Valeur totale</p>
              <p className="mt-1 font-mono text-hero font-bold tracking-[-0.03em] text-text-primary">
                {formatCents(totalValue)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Revenus annuels</p>
              <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                {formatCents(totalAnnualIncome)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Rendement brut</p>
              <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                {formatPercent(grossYield)}
              </p>
            </Card>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        )}

        {!isLoading && assets?.length === 0 && (
          <p className="text-sm text-text-muted">Aucun actif immobilier pour l'instant.</p>
        )}

        {!isLoading && assets && assets.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {assets.map((asset) => (
              <RealEstateAssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </div>
      <CreateRealEstateDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
