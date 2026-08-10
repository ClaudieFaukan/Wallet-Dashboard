import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { useCreateCredit } from '../hooks/useCredits';

export function CreateCreditDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [interestRatePct, setInterestRatePct] = useState('');
  const [earlyRepaymentFeeRatePct, setEarlyRepaymentFeeRatePct] = useState('3');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const create = useCreateCredit();
  const toast = useToast();

  function reset() {
    setName('');
    setInstitution('');
    setInitialAmount('');
    setRemainingAmount('');
    setMonthlyPayment('');
    setInterestRatePct('');
    setEarlyRepaymentFeeRatePct('3');
    setStartDate('');
    setEndDate('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        name,
        institution,
        initialAmount: Math.round(Number(initialAmount) * 100),
        remainingAmount: Math.round(Number(remainingAmount) * 100),
        monthlyPayment: Math.round(Number(monthlyPayment) * 100),
        interestRate: Number(interestRatePct) / 100,
        earlyRepaymentFeeRate: Number(earlyRepaymentFeeRatePct) / 100,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success('Crédit créé');
          reset();
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nouveau crédit">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="Établissement"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          required
        />
        <Input
          label="Montant initial (€)"
          type="number"
          step="0.01"
          min="0"
          value={initialAmount}
          onChange={(e) => setInitialAmount(e.target.value)}
          required
        />
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
        <Input
          label="Frais de remboursement anticipé (%)"
          type="number"
          step="0.01"
          min="0"
          value={earlyRepaymentFeeRatePct}
          onChange={(e) => setEarlyRepaymentFeeRatePct(e.target.value)}
        />
        <Input label="Date de début" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        <Input label="Date de fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Création…' : 'Créer'}
        </Button>
      </form>
    </Drawer>
  );
}
