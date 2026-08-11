import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { CryptoCostEntry } from '../../../types/api';
import { useAddCostEntry, useDeleteCostEntry, useUpdateCostEntry } from '../hooks/useCrypto';

interface CostEntryDrawerProps {
  walletId: string;
  symbol: string;
  /** null = add a new entry for this symbol, set = edit/delete this one. */
  entry: CryptoCostEntry | null;
  open: boolean;
  onClose: () => void;
}

export function CostEntryDrawer({ walletId, symbol, entry, open, onClose }: CostEntryDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={entry ? `Éditer — ${symbol}` : `Coût d'acquisition — ${symbol}`}
    >
      <CostEntryForm key={entry?.id ?? 'new'} walletId={walletId} symbol={symbol} entry={entry} onClose={onClose} />
    </Drawer>
  );
}

function CostEntryForm({
  walletId,
  symbol,
  entry,
  onClose,
}: {
  walletId: string;
  symbol: string;
  entry: CryptoCostEntry | null;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(entry ? (entry.amountInvestedCents / 100).toString() : '');
  const [date, setDate] = useState(
    entry ? entry.purchasedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(entry?.notes ?? '');

  const add = useAddCostEntry(walletId);
  const update = useUpdateCostEntry(walletId);
  const del = useDeleteCostEntry(walletId);
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input = {
      symbol,
      amountInvestedCents: Math.round(Number(amount) * 100),
      purchasedAt: new Date(date).toISOString(),
      notes: notes || undefined,
    };

    if (entry) {
      update.mutate(
        { entryId: entry.id, input },
        {
          onSuccess: () => {
            toast.success('Coût mis à jour');
            onClose();
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        },
      );
    } else {
      add.mutate(input, {
        onSuccess: () => {
          toast.success('Coût enregistré');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      });
    }
  }

  function handleDelete() {
    if (!entry) return;
    del.mutate(entry.id, {
      onSuccess: () => {
        toast.success('Coût supprimé');
        onClose();
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  }

  const isPending = add.isPending || update.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Montant investi (€)"
        type="number"
        step="0.01"
        min="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <Input label="Date d'achat" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <Input
        label="Notes (optionnel)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="ex. Achat DCA mensuel"
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Enregistrement…' : entry ? 'Enregistrer' : 'Ajouter'}
      </Button>
      {entry && (
        <Button type="button" variant="danger" disabled={del.isPending} onClick={handleDelete}>
          {del.isPending ? 'Suppression…' : 'Supprimer'}
        </Button>
      )}
    </form>
  );
}
