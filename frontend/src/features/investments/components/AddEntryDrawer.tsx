import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useMilestoneCelebration } from '../../../components/ui/MilestoneCelebration';
import { getErrorMessage } from '../../../lib/api';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { useAddEntry } from '../hooks/useInvestments';

export function AddEntryDrawer({
  accountId,
  open,
  onClose,
}: {
  accountId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amountInvested, setAmountInvested] = useState('0');
  const [portfolioValue, setPortfolioValue] = useState('0');
  const [ticker, setTicker] = useState('');
  const addEntry = useAddEntry();
  const toast = useToast();
  const celebrate = useMilestoneCelebration();
  const { formatCents } = useFormatCurrency();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    addEntry.mutate(
      {
        id: accountId,
        input: {
          date: new Date(date).toISOString(),
          amountInvested: Math.round(Number(amountInvested) * 100),
          portfolioValue: Math.round(Number(portfolioValue) * 100),
          ticker: ticker || undefined,
        },
      },
      {
        onSuccess: (result) => {
          if (result.reachedMilestones.length > 0) {
            celebrate(result.reachedMilestones.map((m) => formatCents(m.amount)));
          } else {
            toast.success('Entrée DCA enregistrée');
          }
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Ajouter une entrée DCA">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Input
          label="Montant versé (€)"
          type="number"
          step="0.01"
          value={amountInvested}
          onChange={(e) => setAmountInvested(e.target.value)}
        />
        <Input
          label="Valeur du portefeuille après versement (€)"
          type="number"
          step="0.01"
          value={portfolioValue}
          onChange={(e) => setPortfolioValue(e.target.value)}
          required
        />
        <Input
          label="Ticker (optionnel — ex. IWDA.AS)"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Suivi du cours via Alpha Vantage"
        />
        <Button type="submit" disabled={addEntry.isPending}>
          {addEntry.isPending ? 'Enregistrement…' : 'Ajouter'}
        </Button>
      </form>
    </Drawer>
  );
}
