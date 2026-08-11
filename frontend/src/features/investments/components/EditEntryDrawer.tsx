import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { InvestmentAssetType, InvestmentEntry, InvestmentEntryType } from '../../../types/api';
import { useUpdateEntry } from '../hooks/useInvestments';
import { EntryFormFields } from './EntryFormFields';

export function EditEntryDrawer({
  accountId,
  entry,
  open,
  onClose,
}: {
  accountId: string;
  entry: InvestmentEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Éditer l'entrée">
      {entry && <EditEntryForm key={entry.id} accountId={accountId} entry={entry} onClose={onClose} />}
    </Drawer>
  );
}

function EditEntryForm({
  accountId,
  entry,
  onClose,
}: {
  accountId: string;
  entry: InvestmentEntry;
  onClose: () => void;
}) {
  const [date, setDate] = useState(entry.date.slice(0, 10));
  const [amountInvested, setAmountInvested] = useState((entry.amountInvested / 100).toString());
  const [portfolioValue, setPortfolioValue] = useState((entry.portfolioValue / 100).toString());
  const [entryType, setEntryType] = useState<InvestmentEntryType>(entry.entryType);
  const [ticker, setTicker] = useState(entry.ticker ?? '');
  const [assetType, setAssetType] = useState<InvestmentAssetType>(entry.assetType ?? 'etf');
  const [isin, setIsin] = useState(entry.isin ?? '');
  const [shares, setShares] = useState(entry.shares !== null ? entry.shares.toString() : '');

  const update = useUpdateEntry();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate(
      {
        id: accountId,
        entryId: entry.id,
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
        onSuccess: () => {
          toast.success('Entrée mise à jour');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
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
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
