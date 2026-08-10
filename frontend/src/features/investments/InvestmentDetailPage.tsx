import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Variation } from '../../components/ui/Variation';
import { AreaChartCard } from '../../components/charts/AreaChartCard';
import { formatDate } from '../../lib/format';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { AddEntryDrawer } from './components/AddEntryDrawer';
import { DcaSimulator } from './components/DcaSimulator';
import { useInvestmentAccount, useInvestmentEntries, useStockQuote } from './hooks/useInvestments';

export function InvestmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = id ?? '';
  const { data: account } = useInvestmentAccount(accountId);
  const { data: entries } = useInvestmentEntries(accountId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { formatCents } = useFormatCurrency();

  const totalInvested = (entries ?? []).reduce((sum, e) => sum + e.amountInvested, 0);
  const latestTicker = [...(entries ?? [])].reverse().find((e) => e.ticker)?.ticker ?? null;
  const { data: quote } = useStockQuote(latestTicker);

  return (
    <div>
      <Header
        title={account?.name ?? 'Compte'}
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Ajouter une entrée
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-3 gap-4">
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
        </div>

        {quote && (
          <Card>
            <p className="text-sm text-text-secondary">Cours — {quote.symbol}</p>
            <div className="mt-1 flex items-center gap-3">
              <p className="font-mono text-lg font-semibold text-text-primary">{quote.price}</p>
              <Variation percent={quote.changePercent} />
            </div>
          </Card>
        )}

        {entries && entries.length > 0 && (
          <AreaChartCard
            title="Investi vs valeur du portefeuille"
            data={entries.map((e) => ({ label: formatDate(e.date, { month: 'short', year: '2-digit' }), value: e.portfolioValue }))}
            formatValue={(v) => formatCents(v)}
          />
        )}

        <DcaSimulator accountId={accountId} />
      </div>
      <AddEntryDrawer accountId={accountId} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
