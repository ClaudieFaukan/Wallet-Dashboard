import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { RealEstateAsset } from '../../../types/api';
import { useRealEstateHistory, useRecordRealEstateValue } from '../hooks/useRealEstate';

export function UpdateValueDrawer({
  asset,
  open,
  onClose,
}: {
  asset: RealEstateAsset | null;
  open: boolean;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const { data: history } = useRealEstateHistory(asset?.id ?? '');
  const recordValue = useRecordRealEstateValue();
  const toast = useToast();
  const { formatCents } = useFormatCurrency();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!asset) return;
    recordValue.mutate(
      {
        id: asset.id,
        input: {
          date: new Date().toISOString(),
          value: Math.round(Number(value) * 100),
          notes: note || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Valeur mise à jour');
          setValue('');
          setNote('');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  if (!asset) return null;

  return (
    <Drawer open={open} onClose={onClose} title={`Mettre à jour la valeur — ${asset.name}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nouvelle valeur (€)"
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <Input
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="prix de part publié le…"
        />
        <Button type="submit" disabled={recordValue.isPending}>
          {recordValue.isPending ? 'Mise à jour…' : 'Mettre à jour'}
        </Button>
      </form>

      {history && history.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="mb-2 text-xs text-text-muted">Historique</p>
          <ul className="space-y-1.5">
            {[...history].reverse().slice(0, 10).map((h) => (
              <li key={h.id} className="flex justify-between text-xs">
                <span className="text-text-muted">{formatDate(h.date)}</span>
                <span className="font-mono text-text-primary">{formatCents(h.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
