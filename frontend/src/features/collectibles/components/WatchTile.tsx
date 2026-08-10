import { Pencil } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { formatPercent } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { CollectibleItem, CollectiblePerformanceRow } from '../../../types/api';

export function WatchTile({
  item,
  performance,
  onEditPrice,
  onEdit,
}: {
  item: CollectibleItem;
  performance?: CollectiblePerformanceRow;
  onEditPrice: (item: CollectibleItem) => void;
  onEdit: (item: CollectibleItem) => void;
}) {
  const { formatCents } = useFormatCurrency();
  const pct = performance?.gainLossPct ?? null;
  const badgeVariant = pct === null ? 'neutral' : pct >= 0 ? 'success' : 'danger';

  return (
    <Card className="group relative">
      <button
        type="button"
        title="Éditer"
        onClick={() => onEdit(item)}
        className="absolute right-3 top-3 z-10 rounded-md bg-bg-elevated/90 p-1.5 text-text-muted opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100"
      >
        <Pencil size={14} />
      </button>
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-bg-elevated">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-text-muted">Pas d'image</span>
        )}
      </div>
      <p className="mt-3 truncate text-sm font-semibold text-text-primary">{item.name}</p>
      <p className="truncate text-xs text-text-muted">
        {[item.brand, item.model, item.reference].filter(Boolean).join(' · ') || 'Détails à compléter'}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {item.year && <Badge variant="neutral">{item.year}</Badge>}
        {item.watchCondition && <Badge variant="neutral">{item.watchCondition}</Badge>}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <div>
          <p className="text-text-muted">Achat {formatCents(item.purchasePrice)}</p>
          <p className="font-mono text-text-primary">
            {performance?.currentPrice !== null && performance?.currentPrice !== undefined
              ? formatCents(performance.currentPrice)
              : '—'}
          </p>
        </div>
        <Badge variant={badgeVariant}>{pct !== null ? formatPercent(pct) : 'N/A'}</Badge>
      </div>
      <Button
        variant="secondary"
        size="sm"
        icon={<Pencil size={12} />}
        className="mt-3 w-full"
        onClick={() => onEditPrice(item)}
      >
        Mettre à jour le prix
      </Button>
    </Card>
  );
}
