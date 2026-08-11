import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useMilestoneCelebration } from '../../../components/ui/MilestoneCelebration';
import { getErrorMessage } from '../../../lib/api';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { InvestmentAssetType, InvestmentEntryType } from '../../../types/api';
import { useAddEntry } from '../hooks/useInvestments';
import { EntryFormFields } from './EntryFormFields';

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
  const [entryType, setEntryType] = useState<InvestmentEntryType>('contribution');
  const [ticker, setTicker] = useState('');
  const [assetType, setAssetType] = useState<InvestmentAssetType>('etf');
  const [isin, setIsin] = useState('');
  const [shares, setShares] = useState('');
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
          entryType,
          ticker: ticker || undefined,
          assetType: ticker ? assetType : undefined,
          isin: isin || undefined,
          shares: shares ? Number(shares) : undefined,
        },
      },
      {
        onSuccess: (result) => {
          if (result.reachedMilestones.length > 0) {
            celebrate(result.reachedMilestones.map((m) => formatCents(m.amount)));
          } else {
            toast.success(entryType === 'dividend' ? 'Dividende enregistré' : 'Entrée DCA enregistrée');
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
        <EntryFormFields
          date={date}
          onDateChange={setDate}
          amountInvested={amountInvested}
          onAmountInvestedChange={setAmountInvested}
          portfolioValue={portfolioValue}
          onPortfolioValueChange={setPortfolioValue}
          entryType={entryType}
          onEntryTypeChange={setEntryType}
          ticker={ticker}
          onTickerChange={setTicker}
          assetType={assetType}
          onAssetTypeChange={setAssetType}
          isin={isin}
          onIsinChange={setIsin}
          shares={shares}
          onSharesChange={setShares}
        />
        <Button type="submit" disabled={addEntry.isPending}>
          {addEntry.isPending ? 'Enregistrement…' : 'Ajouter'}
        </Button>
      </form>
    </Drawer>
  );
}
