import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatPercent } from '../../lib/format';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { CreditCard } from './components/CreditCard';
import { CreateCreditDrawer } from './components/CreateCreditDrawer';
import { useCredits } from './hooks/useCredits';

export function CreditsPage() {
  const { data: credits, isLoading } = useCredits();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { formatCents } = useFormatCurrency();

  const totalRemaining = (credits ?? []).reduce((sum, c) => sum + c.remainingAmount, 0);
  const totalMonthlyPayment = (credits ?? []).reduce((sum, c) => sum + c.monthlyPayment, 0);
  const weightedRate =
    totalRemaining > 0
      ? (credits ?? []).reduce((sum, c) => sum + c.remainingAmount * c.interestRate, 0) / totalRemaining
      : 0;

  return (
    <div>
      <Header
        title="Crédits"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Nouveau crédit
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        {!isLoading && credits && credits.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <p className="text-sm text-text-secondary">Capital restant dû</p>
              <p className="mt-1 font-mono text-hero font-bold tracking-[-0.03em] text-accent-3">
                {formatCents(totalRemaining)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Mensualités totales</p>
              <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                {formatCents(totalMonthlyPayment)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Taux moyen pondéré</p>
              <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                {formatPercent(weightedRate * 100)}
              </p>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
          {!isLoading && credits?.length === 0 && (
            <p className="col-span-2 text-sm text-text-muted">Aucun crédit pour l'instant.</p>
          )}
          {credits?.map((credit) => (
            <CreditCard key={credit.id} credit={credit} />
          ))}
        </div>
      </div>
      <CreateCreditDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
