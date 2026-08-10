import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatPercent } from '../../lib/format';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { CreateGoalDrawer } from './components/CreateGoalDrawer';
import { SavingsGoalCard } from './components/SavingsGoalCard';
import { useSavingsGoals } from './hooks/useSavings';

export function SavingsPage() {
  const { data: goals, isLoading } = useSavingsGoals();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { formatCents } = useFormatCurrency();

  const totalCurrent = (goals ?? []).reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = (goals ?? []).reduce((sum, g) => sum + g.targetAmount, 0);
  const avgProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  return (
    <div>
      <Header
        title="Épargne"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Nouvel objectif
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        {!isLoading && goals && goals.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <p className="text-sm text-text-secondary">Épargne totale</p>
              <p className="mt-1 font-mono text-hero font-bold tracking-[-0.03em] text-text-primary">
                {formatCents(totalCurrent)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Objectif total</p>
              <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                {formatCents(totalTarget)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Progression moyenne</p>
              <p className="mt-1 font-mono text-lg font-semibold text-accent-2">
                {formatPercent(avgProgress)}
              </p>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
          {!isLoading && goals?.length === 0 && (
            <p className="col-span-2 text-sm text-text-muted">Aucun objectif pour l'instant.</p>
          )}
          {goals?.map((goal) => (
            <SavingsGoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      </div>
      <CreateGoalDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
