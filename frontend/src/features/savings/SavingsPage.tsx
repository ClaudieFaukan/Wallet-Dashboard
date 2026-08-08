import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { CreateGoalDrawer } from './components/CreateGoalDrawer';
import { SavingsGoalCard } from './components/SavingsGoalCard';
import { useSavingsGoals } from './hooks/useSavings';

export function SavingsPage() {
  const { data: goals, isLoading } = useSavingsGoals();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      <div className="grid grid-cols-2 gap-4 p-8">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
        {goals?.map((goal) => (
          <SavingsGoalCard key={goal.id} goal={goal} />
        ))}
      </div>
      <CreateGoalDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
