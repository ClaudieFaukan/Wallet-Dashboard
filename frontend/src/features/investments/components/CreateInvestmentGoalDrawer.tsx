import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { getErrorMessage } from '../../../lib/api';
import { useCreateInvestmentGoal } from '../hooks/useInvestments';

export function CreateInvestmentGoalDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const create = useCreateInvestmentGoal();
  const toast = useToast();
  const { displayCurrency, fromDisplayCents } = useFormatCurrency();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { name, targetAmount: fromDisplayCents(Math.round(Number(targetAmount) * 100)) },
      {
        onSuccess: () => {
          toast.success('Objectif créé');
          setName('');
          setTargetAmount('');
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
          label={`Montant cible (${displayCurrency})`}
          type="number"
          step="0.01"
          min="1"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          required
        />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Création…' : "Créer l'objectif"}
        </Button>
      </form>
    </Drawer>
  );
}
