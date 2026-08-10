import { useState } from 'react';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { formatPercent } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { RealEstateAsset } from '../../../types/api';
import { useDeleteRealEstateAsset } from '../hooks/useRealEstate';
import { EditRealEstateDrawer } from './EditRealEstateDrawer';
import { UpdateValueDrawer } from './UpdateValueDrawer';

const typeLabels: Record<RealEstateAsset['type'], string> = {
  physical: 'Physique',
  scpi: 'SCPI',
  crowdfunding: 'Crowdfunding',
};

export function RealEstateAssetCard({ asset }: { asset: RealEstateAsset }) {
  const [editOpen, setEditOpen] = useState(false);
  const [valueOpen, setValueOpen] = useState(false);
  const deleteAsset = useDeleteRealEstateAsset();
  const toast = useToast();
  const { formatCents } = useFormatCurrency();

  const annualIncome = asset.monthlyIncome * 12;
  const grossYield = asset.currentValue > 0 ? (annualIncome / asset.currentValue) * 100 : 0;

  function handleDelete() {
    deleteAsset.mutate(asset.id, { onError: (err) => toast.error(getErrorMessage(err)) });
  }

  return (
    <Card className="group relative">
      <div className="absolute right-4 top-4 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title="Éditer"
          onClick={() => setEditOpen(true)}
          className="rounded-md p-1.5 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          title="Supprimer"
          onClick={handleDelete}
          className="rounded-md p-1.5 text-text-muted hover:bg-bg-elevated hover:text-accent-3"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-text-primary">{asset.name}</p>
        <Badge variant="accent">{typeLabels[asset.type]}</Badge>
      </div>
      <p className="text-xs text-text-muted">
        {asset.type === 'physical' && [asset.location, asset.surfaceM2 ? `${asset.surfaceM2} m²` : null].filter(Boolean).join(' · ')}
        {asset.type === 'crowdfunding' && asset.platform}
        {asset.type === 'scpi' && 'SCPI'}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-text-muted">Valeur</p>
          <p className="font-mono text-text-primary">{formatCents(asset.currentValue)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Revenu mensuel</p>
          <p className="font-mono text-text-primary">{formatCents(asset.monthlyIncome)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Rendement brut</p>
          <p className="font-mono text-text-primary">{formatPercent(grossYield)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setValueOpen(true)}
        className="mt-3 flex items-center gap-1.5 text-xs text-accent-gold hover:underline"
      >
        <RefreshCw size={12} /> Mettre à jour la valeur
      </button>

      <EditRealEstateDrawer asset={editOpen ? asset : null} open={editOpen} onClose={() => setEditOpen(false)} />
      <UpdateValueDrawer asset={valueOpen ? asset : null} open={valueOpen} onClose={() => setValueOpen(false)} />
    </Card>
  );
}
