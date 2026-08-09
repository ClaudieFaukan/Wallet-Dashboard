import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { SavingsGoal } from '../../../types/api';
import { useUpdateSavingsGoal } from '../hooks/useSavings';

export function EditGoalDrawer({
  goal,
  open,
  onClose,
}: {
  goal: SavingsGoal | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={goal ? `Éditer — ${goal.name}` : 'Éditer'}>
      {goal && <EditGoalForm key={goal.id} goal={goal} onClose={onClose} />}
    </Drawer>
  );
}

function EditGoalForm({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const [name, setName] = useState(goal.name);
  const [targetAmount, setTargetAmount] = useState((goal.targetAmount / 100).toString());
  const [deadline, setDeadline] = useState(goal.deadline?.slice(0, 10) ?? '');
  const [color, setColor] = useState(goal.color ?? '');
  const [icon, setIcon] = useState(goal.icon ?? '');

  const update = useUpdateSavingsGoal();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate(
      {
        id: goal.id,
        input: {
          name,
          targetAmount: Math.round(Number(targetAmount) * 100),
          deadline: deadline || undefined,
          color: color || undefined,
          icon: icon || undefined,
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
      <Input label="Échéance" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      <Input label="Couleur" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#6366f1" />
      <Input label="Icône" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="piggy-bank" />
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
