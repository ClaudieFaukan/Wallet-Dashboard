import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { Credit } from '../../../types/api';
import { useUpdateCredit } from '../hooks/useCredits';

export function EditCreditDrawer({
  credit,
  open,
  onClose,
}: {
  credit: Credit | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={credit ? `Éditer — ${credit.name}` : 'Éditer'}>
      {credit && <EditCreditForm key={credit.id} credit={credit} onClose={onClose} />}
    </Drawer>
  );
}

function EditCreditForm({ credit, onClose }: { credit: Credit; onClose: () => void }) {
  const [name, setName] = useState(credit.name);
  const [institution, setInstitution] = useState(credit.institution);
  const [remainingAmount, setRemainingAmount] = useState((credit.remainingAmount / 100).toString());
  const [monthlyPayment, setMonthlyPayment] = useState((credit.monthlyPayment / 100).toString());
  const [interestRatePct, setInterestRatePct] = useState((credit.interestRate * 100).toString());

  const update = useUpdateCredit();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate(
      {
        id: credit.id,
        input: {
          name,
          institution,
          remainingAmount: Math.round(Number(remainingAmount) * 100),
          monthlyPayment: Math.round(Number(monthlyPayment) * 100),
          interestRate: Number(interestRatePct) / 100,
        },
      },
      {
        onSuccess: () => {
          toast.success('Crédit mis à jour');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Établissement" value={institution} onChange={(e) => setInstitution(e.target.value)} required />
      <Input
        label="Capital restant dû (€)"
        type="number"
        step="0.01"
        min="0"
        value={remainingAmount}
        onChange={(e) => setRemainingAmount(e.target.value)}
        required
      />
      <Input
        label="Mensualité (€)"
        type="number"
        step="0.01"
        min="0"
        value={monthlyPayment}
        onChange={(e) => setMonthlyPayment(e.target.value)}
        required
      />
      <Input
        label="Taux d'intérêt annuel (%)"
        type="number"
        step="0.01"
        min="0"
        value={interestRatePct}
        onChange={(e) => setInterestRatePct(e.target.value)}
        required
      />
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
