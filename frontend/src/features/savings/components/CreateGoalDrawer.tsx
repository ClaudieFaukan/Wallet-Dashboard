import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { useCreateSavingsGoal } from '../hooks/useSavings';

export function CreateGoalDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const create = useCreateSavingsGoal();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        name,
        targetAmount: Math.round(Number(targetAmount) * 100),
        deadline: deadline || undefined,
        type: 'custom',
      },
      {
        onSuccess: () => {
          toast.success('Objectif créé');
          setName('');
          setTargetAmount('');
          setDeadline('');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nouvel objectif">
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
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Création…' : "Créer l'objectif"}
        </Button>
      </form>
    </Drawer>
  );
}
