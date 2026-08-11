import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { InvestmentGoal } from '../../../types/api';
import { useDeleteInvestmentGoal, useUpdateInvestmentGoal } from '../hooks/useInvestments';

export function EditInvestmentGoalDrawer({
  goal,
  open,
  onClose,
}: {
  goal: InvestmentGoal | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={goal ? `Éditer — ${goal.name}` : 'Éditer'}>
      {goal && <EditGoalForm key={goal.id} goal={goal} onClose={onClose} />}
    </Drawer>
  );
}

function EditGoalForm({ goal, onClose }: { goal: InvestmentGoal; onClose: () => void }) {
  const [name, setName] = useState(goal.name);
  const [targetAmount, setTargetAmount] = useState((goal.targetAmount / 100).toString());
  const [color, setColor] = useState(goal.color ?? '');

  const update = useUpdateInvestmentGoal();
  const deleteGoal = useDeleteInvestmentGoal();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate(
      {
        id: goal.id,
        input: {
          name,
          targetAmount: Math.round(Number(targetAmount) * 100),
          color: color || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Objectif mis à jour');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  function handleDelete() {
    deleteGoal.mutate(goal.id, {
      onSuccess: () => {
        toast.success('Objectif supprimé');
        onClose();
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input
        label="Montant cible (€)"
        type="number"
        step="0.01"
        min="1"
        value={targetAmount}
        onChange={(e) => setTargetAmount(e.target.value)}
        required
      />
      <Input label="Couleur" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#6366f1" />
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
      <Button type="button" variant="danger" disabled={deleteGoal.isPending} onClick={handleDelete}>
        {deleteGoal.isPending ? 'Suppression…' : "Supprimer l'objectif"}
      </Button>
    </form>
  );
}
