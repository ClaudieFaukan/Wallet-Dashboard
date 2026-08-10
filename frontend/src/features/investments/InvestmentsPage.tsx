import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Variation } from '../../components/ui/Variation';
import { ProgressBar } from '../../components/charts/ProgressBar';
import { formatDate } from '../../lib/format';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { usePatrimoineRows } from '../../hooks/usePatrimoineRows';
import { CreateInvestmentAccountDrawer } from './components/CreateInvestmentAccountDrawer';
import { useInvestmentAccounts, useInvestmentMilestones } from './hooks/useInvestments';

export function InvestmentsPage() {
  const { data: accounts, isLoading } = useInvestmentAccounts();
  const { data: milestones } = useInvestmentMilestones();
  const patrimoine = usePatrimoineRows();
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  return (
    <div>
      <Header
        title="Investir"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Nouveau compte
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        {!patrimoine.isLoading && investmentRows.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
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
          </div>
        )}

        {milestones && (milestones.reached.length > 0 || milestones.next.length > 0) && (
          <Card>
            <p className="mb-3 text-sm text-text-secondary">
              Total investi {formatCents(milestones.currentTotal)}
            </p>
            {milestones.reached.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {milestones.reached.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-text-primary">
                      <CheckCircle2 size={14} className="text-accent-2" /> {formatCents(m.amount)}
                    </span>
                    <Badge variant="success">{m.reachedAt ? formatDate(m.reachedAt) : ''}</Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-3">
              {milestones.next.map((m) => (
                <ProgressBar
                  key={m.amount}
                  value={m.progress * 100}
                  label={`Jalon ${formatCents(m.amount)} — manque ${formatCents(m.missingAmount)}`}
                />
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-4">
          {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          {accounts?.map((account) => {
            const row = rowsById.get(account.id);
            return (
              <Link key={account.id} to={`/investments/${account.id}`}>
                <Card className="transition-colors hover:border-accent-gold/50">
                  <p className="text-sm font-semibold text-text-primary">{account.name}</p>
                  {account.platform && <p className="text-xs text-text-muted">{account.platform}</p>}
                  <p className="mt-2 font-mono text-lg font-semibold text-text-primary">
                    {formatCents(account.currentValue, account.currency)}
                  </p>
                  {row?.allTimeGain !== null && row?.allTimeGain !== undefined && (
                    <div className="mt-1">
                      <Variation amountCents={row.allTimeGain} percent={row.allTimeGainPct} />
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
      <CreateInvestmentAccountDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
