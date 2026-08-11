import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { CircularProgress } from '../../../components/charts/CircularProgress';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { InvestmentGoal } from '../../../types/api';
import { useInvestmentGoals } from '../hooks/useInvestments';
import { CreateInvestmentGoalDrawer } from './CreateInvestmentGoalDrawer';
import { EditInvestmentGoalDrawer } from './EditInvestmentGoalDrawer';

// Deliberately compact — one row of small chips rather than a stacked list of progress
// bars, since a global target (across all accounts) doesn't carry enough per-goal detail
// to justify more vertical space than the account cards below it.
export function ObjectivesCard({ totalValue }: { totalValue: number }) {
  const { data: goals } = useInvestmentGoals();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<InvestmentGoal | null>(null);
  const { formatCompactCents } = useFormatCurrency();

  return (
    <Card>
      <p className="mb-3 text-sm font-semibold text-text-primary">Objectifs</p>
      <div className="flex flex-wrap gap-5">
        {goals?.map((goal) => (
          <button
            key={goal.id}
            type="button"
            onClick={() => setEditingGoal(goal)}
            className="flex w-20 flex-col items-center gap-1.5 text-center"
          >
            <CircularProgress
              value={totalValue}
              max={goal.targetAmount}
              size={64}
              strokeWidth={6}
              color={goal.color ?? undefined}
            />
            <span className="line-clamp-1 w-full text-xs text-text-primary">{goal.name}</span>
            <span className="font-mono text-[10px] text-text-muted">
              {formatCompactCents(goal.targetAmount)}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex w-20 flex-col items-center gap-1.5 text-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-border text-text-muted transition-colors hover:border-accent-gold/50 hover:text-text-primary">
            <Plus size={20} />
          </span>
          <span className="text-xs text-text-muted">Ajouter</span>
        </button>
      </div>

      <CreateInvestmentGoalDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditInvestmentGoalDrawer
        goal={editingGoal}
        open={editingGoal !== null}
        onClose={() => setEditingGoal(null)}
      />
    </Card>
  );
}
