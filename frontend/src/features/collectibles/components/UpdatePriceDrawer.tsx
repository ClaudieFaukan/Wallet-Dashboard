import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { formatCents, formatDate } from '../../../lib/format';
import type { CollectibleItem } from '../../../types/api';
import { useCollectibleWithHistory, useUpdatePrice } from '../hooks/useCollectibles';

export function UpdatePriceDrawer({
  item,
  open,
  onClose,
}: {
  item: CollectibleItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [priceEur, setPriceEur] = useState('');
  const [note, setNote] = useState('');
  const { data } = useCollectibleWithHistory(item?.id ?? '');
  const updatePrice = useUpdatePrice();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    updatePrice.mutate(
      { id: item.id, input: { priceEur: Math.round(Number(priceEur) * 100), note: note || undefined } },
      {
        onSuccess: () => {
          toast.success('Prix mis à jour');
          setPriceEur('');
          setNote('');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  if (!item) return null;

  return (
    <Drawer open={open} onClose={onClose} title={`Mettre à jour le prix — ${item.name}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Prix actuel (€)"
          type="number"
          step="0.01"
          value={priceEur}
          onChange={(e) => setPriceEur(e.target.value)}
          required
        />
        <Input
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="vu sur Cardmarket le…"
        />
        <Button type="submit" disabled={updatePrice.isPending}>
          {updatePrice.isPending ? 'Mise à jour…' : 'Mettre à jour'}
        </Button>
      </form>

      {data && data.history.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="mb-2 text-xs text-text-muted">Historique</p>
          <ul className="space-y-1.5">
            {data.history.slice(0, 10).map((h) => (
              <li key={h.id} className="flex justify-between text-xs">
                <span className="text-text-muted">{formatDate(h.fetchedAt)}</span>
                <span className="font-mono text-text-primary">
                  {h.marketPriceEur !== null ? formatCents(h.marketPriceEur) : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
