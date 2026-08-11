import { useState, type FormEvent } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { CollectibleItem, CollectiblePriceSnapshot } from '../../../types/api';
import {
  useCollectibleWithHistory,
  useDeletePriceSnapshot,
  useUpdatePrice,
  useUpdatePriceSnapshot,
} from '../hooks/useCollectibles';

function snapshotNote(rawData: unknown): string {
  if (rawData && typeof rawData === 'object' && 'note' in rawData) {
    const note = (rawData as { note?: unknown }).note;
    return typeof note === 'string' ? note : '';
  }
  return '';
}

function HistoryRow({ itemId, snapshot }: { itemId: string; snapshot: CollectiblePriceSnapshot }) {
  const [editing, setEditing] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [editNote, setEditNote] = useState('');
  const updateSnapshot = useUpdatePriceSnapshot();
  const deleteSnapshot = useDeletePriceSnapshot();
  const toast = useToast();
  const { formatCents, toDisplayCents, fromDisplayCents } = useFormatCurrency();

  function startEdit() {
    setEditPrice(
      snapshot.marketPriceEur !== null ? String(toDisplayCents(snapshot.marketPriceEur) / 100) : '',
    );
    setEditNote(snapshotNote(snapshot.rawData));
    setEditing(true);
  }

  function handleSave() {
    updateSnapshot.mutate(
      {
        id: itemId,
        snapshotId: snapshot.id,
        input: {
          priceEur: fromDisplayCents(Math.round(Number(editPrice) * 100)),
          note: editNote || undefined,
        },
      },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  function handleDelete() {
    deleteSnapshot.mutate(
      { id: itemId, snapshotId: snapshot.id },
      { onError: (err) => toast.error(getErrorMessage(err)) },
    );
  }

  if (editing) {
    return (
      <li className="flex items-center gap-1.5">
        <input
          type="number"
          step="0.01"
          value={editPrice}
          onChange={(e) => setEditPrice(e.target.value)}
          className="w-20 rounded-md border border-border bg-bg-elevated px-1.5 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
        />
        <input
          type="text"
          value={editNote}
          onChange={(e) => setEditNote(e.target.value)}
          placeholder="Note"
          className="min-w-0 flex-1 rounded-md border border-border bg-bg-elevated px-1.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          title="Enregistrer"
          onClick={handleSave}
          disabled={updateSnapshot.isPending}
          className="rounded-md p-1 text-text-muted hover:bg-bg-surface hover:text-accent-2"
        >
          <Check size={13} />
        </button>
        <button
          type="button"
          title="Annuler"
          onClick={() => setEditing(false)}
          className="rounded-md p-1 text-text-muted hover:bg-bg-surface hover:text-text-primary"
        >
          <X size={13} />
        </button>
      </li>
    );
  }

  return (
    <li className="group flex items-center justify-between gap-2 text-xs">
      <span className="text-text-muted">{formatDate(snapshot.fetchedAt)}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-text-primary">
          {snapshot.marketPriceEur !== null ? formatCents(snapshot.marketPriceEur) : '—'}
        </span>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            title="Éditer"
            onClick={startEdit}
            className="rounded-md p-1 text-text-muted hover:bg-bg-surface hover:text-text-primary"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            title="Supprimer"
            onClick={handleDelete}
            className="rounded-md p-1 text-text-muted hover:bg-bg-surface hover:text-accent-3"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </li>
  );
}

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
  const { displayCurrency, fromDisplayCents } = useFormatCurrency();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    updatePrice.mutate(
      {
        id: item.id,
        input: {
          priceEur: fromDisplayCents(Math.round(Number(priceEur) * 100)),
          note: note || undefined,
        },
      },
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
          label={`Prix actuel (${displayCurrency})`}
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
          <ul className="space-y-1">
            {data.history.slice(0, 10).map((h) => (
              <HistoryRow key={h.id} itemId={item.id} snapshot={h} />
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
