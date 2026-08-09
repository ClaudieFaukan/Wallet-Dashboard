import { useState } from 'react';
import { CheckCircle2, Circle, Pencil, PlusCircle } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { CircularProgress } from '../../../components/charts/CircularProgress';
import { formatCents, formatDate } from '../../../lib/format';
import type { SavingsGoal } from '../../../types/api';
import { useSavingsDeposits } from '../hooks/useSavings';
import { DepositDrawer } from './DepositDrawer';
import { EditGoalDrawer } from './EditGoalDrawer';

const MILESTONE_PERCENTAGES = [25, 50, 75, 100];

export function SavingsGoalCard({ goal }: { goal: SavingsGoal }) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { data: deposits } = useSavingsDeposits(goal.id);
  const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

  return (
    <Card className="group relative">
      <button
        type="button"
        title="Éditer"
        onClick={() => setEditOpen(true)}
        className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-text-muted opacity-0 transition-opacity hover:bg-bg-elevated hover:text-text-primary group-hover:opacity-100"
      >
        <Pencil size={14} />
      </button>
      <div className="flex items-center gap-4">
        <CircularProgress value={pct} label={goal.name} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-text-primary">{goal.name}</p>
          <p className="font-mono text-sm text-text-muted">
            {formatCents(goal.currentAmount)} / {formatCents(goal.targetAmount)}
          </p>
          <Button size="sm" variant="secondary" icon={<PlusCircle size={14} />} className="mt-2" onClick={() => setDepositOpen(true)}>
            Déposer
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
        {MILESTONE_PERCENTAGES.map((p) => (
          <div key={p} className="flex items-center gap-1 text-xs text-text-muted">
            {pct >= p ? <CheckCircle2 size={14} className="text-accent-2" /> : <Circle size={14} />}
            {p}%
          </div>
        ))}
      </div>

      {deposits && deposits.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-xs text-text-muted">Derniers dépôts</p>
          <ul className="space-y-1">
            {deposits
              .slice(-4)
              .reverse()
              .map((d) => (
                <li key={d.id} className="flex justify-between text-xs">
                  <span className="text-text-muted">{formatDate(d.date)}</span>
                  <span className="font-mono text-accent-2">+{formatCents(d.amount)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <DepositDrawer goal={goal} open={depositOpen} onClose={() => setDepositOpen(false)} />
      <EditGoalDrawer goal={editOpen ? goal : null} open={editOpen} onClose={() => setEditOpen(false)} />
    </Card>
  );
}
