import { useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { formatDate } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { getErrorMessage } from '../../../lib/api';
import type { SavingsDeposit, SavingsGoal } from '../../../types/api';
import { useDeleteDeposit, useSavingsDeposits, useUpdateDeposit } from '../hooks/useSavings';

export function DepositsModal({
  goal,
  open,
  onClose,
}: {
  goal: SavingsGoal;
  open: boolean;
  onClose: () => void;
}) {
  const { data: deposits } = useSavingsDeposits(goal.id);

  return (
    <Modal open={open} onClose={onClose} title={`Dépôts — ${goal.name}`} size="lg">
      <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
        {deposits?.length === 0 && <p className="text-sm text-text-muted">Aucun dépôt pour l'instant.</p>}
        {[...(deposits ?? [])]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((deposit) => (
            <DepositRow key={deposit.id} goalId={goal.id} deposit={deposit} />
          ))}
      </div>
    </Modal>
  );
}

function DepositRow({ goalId, deposit }: { goalId: string; deposit: SavingsDeposit }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState((deposit.amount / 100).toString());
  const [date, setDate] = useState(deposit.date.slice(0, 10));
  const { formatCents } = useFormatCurrency();
  const update = useUpdateDeposit();
  const del = useDeleteDeposit();
  const toast = useToast();

  function handleSave() {
    update.mutate(
      {
        id: goalId,
        depositId: deposit.id,
        input: {
          amount: Math.round(Number(amount) * 100),
          date: new Date(date).toISOString(),
        },
      },
      {
        onSuccess: () => {
          toast.success('Dépôt mis à jour');
          setEditing(false);
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  function handleDelete() {
    del.mutate(
      { id: goalId, depositId: deposit.id },
      {
        onSuccess: () => toast.success('Dépôt supprimé'),
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-accent/50 bg-bg-elevated px-3 py-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 py-1.5 text-sm"
        />
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 py-1.5 text-sm"
        />
        <button
          type="button"
          title="Enregistrer"
          onClick={handleSave}
          disabled={update.isPending}
          className="rounded-md p-1.5 text-accent-2 hover:bg-bg-surface disabled:opacity-50"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          title="Annuler"
          onClick={() => setEditing(false)}
          className="rounded-md p-1.5 text-text-muted hover:bg-bg-surface"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
      <span className="text-text-muted">{formatDate(deposit.date)}</span>
      <span className="font-mono text-accent-2">+{formatCents(deposit.amount)}</span>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title="Éditer"
          onClick={() => setEditing(true)}
          className="rounded-md p-1.5 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          title="Supprimer"
          onClick={handleDelete}
          disabled={del.isPending}
          className="rounded-md p-1.5 text-text-muted hover:bg-bg-elevated hover:text-accent-3 disabled:opacity-50"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
