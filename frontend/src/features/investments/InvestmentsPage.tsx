import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Calculator, Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Variation } from '../../components/ui/Variation';
import { api } from '../../lib/api';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { usePatrimoineRows } from '../../hooks/usePatrimoineRows';
import { CreateInvestmentAccountDrawer } from './components/CreateInvestmentAccountDrawer';
import { DcaSimulatorModal } from './components/DcaSimulatorModal';
import { InvestmentAccountCard } from './components/InvestmentAccountCard';
import { ObjectivesCard } from './components/ObjectivesCard';
import { investmentsKey, useInvestmentAccounts } from './hooks/useInvestments';

export function InvestmentsPage() {
  const { data: accounts, isLoading } = useInvestmentAccounts();
  const patrimoine = usePatrimoineRows();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const { formatCents } = useFormatCurrency();

  // Reuses the per-account gain already computed for the Patrimoine page
  // (same React Query cache, no extra fetch) rather than re-deriving it here.
  const investmentRows = patrimoine.rows.filter((r) => r.kind === 'investment');
  const rowsById = new Map(investmentRows.map((r) => [r.id, r]));
  const totalValue = investmentRows.reduce((sum, r) => sum + r.value, 0);
  const rowsWithGain = investmentRows.filter((r) => r.allTimeGain !== null);
  const totalInvestedKnown = rowsWithGain.reduce((sum, r) => sum + (r.value - r.allTimeGain!), 0);
  const totalGainKnown = rowsWithGain.reduce((sum, r) => sum + r.allTimeGain!, 0);
  const totalGainPct = totalInvestedKnown > 0 ? (totalGainKnown / totalInvestedKnown) * 100 : null;

  // Same queryKey shape usePatrimoineRows already fetches entries under — hits the shared cache
  // rather than firing new requests, just to tally fees across every account.
  const entriesQueries = useQueries({
    queries: (accounts ?? []).map((acc) => ({
      queryKey: [...investmentsKey, acc.id, 'entries'],
      queryFn: () => api.investments.entries(acc.id),
      enabled: accounts !== undefined,
    })),
  });
  const totalFees = entriesQueries.reduce(
    (sum, q) => sum + (q.data ?? []).filter((e) => e.entryType === 'fee').reduce((s, e) => s + e.amountInvested, 0),
    0,
  );

  return (
    <div>
      <Header
        title="Investir"
        actions={
          <>
            {accounts && accounts.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Calculator size={14} />}
                onClick={() => setSimulatorOpen(true)}
              >
                Simulateur DCA
              </Button>
            )}
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
              Nouveau compte
            </Button>
          </>
        }
      />
      <div className="space-y-6 p-8">
        {!patrimoine.isLoading && investmentRows.length > 0 && (
          <div className={`grid gap-4 ${totalFees > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <Card>
              <p className="text-sm text-text-secondary">Valeur actuelle</p>
              <p className="mt-1 font-mono text-hero font-bold tracking-[-0.03em] text-text-primary">
                {formatCents(totalValue)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Total investi</p>
              <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                {formatCents(totalInvestedKnown)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Performance globale</p>
              <div className="mt-1">
                {totalGainPct !== null ? (
                  <Variation amountCents={totalGainKnown} percent={totalGainPct} className="text-base" />
                ) : (
                  <span className="font-mono text-lg font-semibold text-text-primary">—</span>
                )}
              </div>
            </Card>
            {totalFees > 0 && (
              <Card>
                <p className="text-sm text-text-secondary">Frais prélevés (total)</p>
                <p className="mt-1 font-mono text-lg font-semibold text-accent-3">{formatCents(totalFees)}</p>
              </Card>
            )}
          </div>
        )}

        <ObjectivesCard totalValue={totalValue} />

        <div className="grid grid-cols-3 gap-4">
          {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          {accounts?.map((account) => {
            const row = rowsById.get(account.id);
            return (
              <InvestmentAccountCard
                key={account.id}
                account={account}
                allTimeGain={row?.allTimeGain ?? null}
                allTimeGainPct={row?.allTimeGainPct ?? null}
              />
            );
          })}
        </div>
      </div>
      <CreateInvestmentAccountDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {accounts && accounts.length > 0 && (
        <DcaSimulatorModal accounts={accounts} open={simulatorOpen} onClose={() => setSimulatorOpen(false)} />
      )}
    </div>
  );
}
