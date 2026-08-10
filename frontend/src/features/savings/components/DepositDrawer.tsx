import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useMilestoneCelebration } from '../../../components/ui/MilestoneCelebration';
import { getErrorMessage } from '../../../lib/api';
import type { SavingsGoal } from '../../../types/api';
import { useDeposit } from '../hooks/useSavings';

export function DepositDrawer({
  goal,
  open,
  onClose,
}: {
  goal: SavingsGoal;
  open: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('0');
  const deposit = useDeposit();
  const toast = useToast();
  const celebrate = useMilestoneCelebration();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    deposit.mutate(
      { id: goal.id, amount: Math.round(Number(amount) * 100) },
      {
        onSuccess: (result) => {
          if (result.reachedMilestones.length > 0) {
            celebrate(result.reachedMilestones.map((m) => m.name));
          } else {
            toast.success('Dépôt enregistré');
          }
          setAmount('0');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title={`Déposer — ${goal.name}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Montant (€)"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Button type="submit" disabled={deposit.isPending}>
          {deposit.isPending ? 'Enregistrement…' : 'Déposer'}
        </Button>
      </form>
    </Drawer>
  );
}
