import { useState } from 'react';
import { List, Pencil, PlusCircle } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { CircularProgress } from '../../../components/charts/CircularProgress';
import { MilestoneMarker } from '../../../components/charts/MilestoneMarker';
import { formatDate } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { SavingsGoal } from '../../../types/api';
import { useSavingsDeposits, useSavingsMilestones } from '../hooks/useSavings';
import { DepositDrawer } from './DepositDrawer';
import { DepositsModal } from './DepositsModal';
import { EditGoalDrawer } from './EditGoalDrawer';

// Mirrors backend MILESTONE_PERCENTAGES (savings.service.ts) — the API doesn't
// enumerate not-yet-reachable milestones separately, so the checkpoints the UI
// draws chips for have to be listed here too.
const MILESTONE_PERCENTAGES = [25, 50, 75, 100];

export function SavingsGoalCard({ goal }: { goal: SavingsGoal }) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [depositsModalOpen, setDepositsModalOpen] = useState(false);
  const { data: deposits } = useSavingsDeposits(goal.id);
  const { data: milestones } = useSavingsMilestones(goal.id);
  const { formatCents } = useFormatCurrency();
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
        <CircularProgress value={pct} color={goal.color ?? undefined} />
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

      {milestones && goal.targetAmount > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs text-text-muted">Jalons</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MILESTONE_PERCENTAGES.map((p) => {
              const reached = milestones.reached.find((m) => m.name === `${p}%`);
              const next = milestones.next.find((m) => m.percentage === p);
              return (
                <MilestoneMarker
                  key={p}
                  label={`${p}%`}
                  reached={Boolean(reached)}
                  date={
                    reached
                      ? reached.reachedAt
                        ? formatDate(reached.reachedAt)
                        : null
                      : (next && formatCents(next.amount)) ?? null
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {deposits && deposits.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-text-muted">Derniers dépôts</p>
            <button
              type="button"
              onClick={() => setDepositsModalOpen(true)}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
            >
              <List size={12} /> Tout voir ({deposits.length})
            </button>
          </div>
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
      <DepositsModal goal={goal} open={depositsModalOpen} onClose={() => setDepositsModalOpen(false)} />
    </Card>
  );
}
