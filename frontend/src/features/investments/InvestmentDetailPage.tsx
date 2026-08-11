import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Variation } from '../../components/ui/Variation';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { AddEntryDrawer } from './components/AddEntryDrawer';
import { EntriesHistory } from './components/EntriesHistory';
import { PositionsCard } from './components/PositionsCard';
import { useInvestmentAccount, useInvestmentEntries } from './hooks/useInvestments';

export function InvestmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = id ?? '';
  const { data: account } = useInvestmentAccount(accountId);
  const { data: entries } = useInvestmentEntries(accountId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { formatCents } = useFormatCurrency();

  // Dividends aren't money out of the user's pocket — excluded from the cost basis used for
  // "Total investi"/Performance, surfaced separately instead (see AddEntryDrawer/EntryFormFields).
  const totalInvested = (entries ?? [])
    .filter((e) => e.entryType !== 'dividend')
    .reduce((sum, e) => sum + e.amountInvested, 0);
  const totalDividends = (entries ?? [])
    .filter((e) => e.entryType === 'dividend')
    .reduce((sum, e) => sum + e.amountInvested, 0);

  return (
    <div>
      <Header
        title={account?.name ?? 'Compte'}
        backTo="/investments"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Ajouter une entrée
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        <div className={`grid gap-4 ${totalDividends > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <Card>
            <p className="text-sm text-text-secondary">Total investi</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">{formatCents(totalInvested)}</p>
          </Card>
          <Card>
            <p className="text-sm text-text-secondary">Valeur actuelle</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(account?.currentValue ?? 0)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-text-secondary">Performance</p>
            <div className="mt-1">
              {totalInvested > 0 ? (
                <Variation
                  amountCents={(account?.currentValue ?? 0) - totalInvested}
                  percent={(((account?.currentValue ?? 0) - totalInvested) / totalInvested) * 100}
                />
              ) : (
                <span className="font-mono text-lg font-semibold text-text-primary">—</span>
              )}
            </div>
          </Card>
          {totalDividends > 0 && (
            <Card>
              <p className="text-sm text-text-secondary">Dividendes reçus</p>
              <p className="mt-1 font-mono text-lg font-semibold text-accent-2">{formatCents(totalDividends)}</p>
            </Card>
          )}
        </div>

        <EntriesHistory accountId={accountId} entries={entries ?? []} />

        <PositionsCard accountId={accountId} entries={entries ?? []} />
      </div>
      <AddEntryDrawer accountId={accountId} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
