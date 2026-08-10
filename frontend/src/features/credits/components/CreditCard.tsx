import { useState } from 'react';
import { Calculator, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ProgressBar } from '../../../components/charts/ProgressBar';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { formatDate, formatPercent } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { Credit } from '../../../types/api';
import { useDeleteCredit } from '../hooks/useCredits';
import { EditCreditDrawer } from './EditCreditDrawer';
import { RepaymentSimulatorDrawer } from './RepaymentSimulatorDrawer';

export function CreditCard({ credit }: { credit: Credit }) {
  const [editOpen, setEditOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const deleteCredit = useDeleteCredit();
  const toast = useToast();
  const { formatCents } = useFormatCurrency();

  const repaidAmount = credit.initialAmount - credit.remainingAmount;
  const repaidPct = credit.initialAmount > 0 ? (repaidAmount / credit.initialAmount) * 100 : 0;

  function handleDelete() {
    deleteCredit.mutate(credit.id, { onError: (err) => toast.error(getErrorMessage(err)) });
  }

  return (
    <Card className="group relative">
      <div className="absolute right-4 top-4 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title="Éditer"
          onClick={() => setEditOpen(true)}
          className="rounded-md p-1.5 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          title="Supprimer"
          onClick={handleDelete}
          className="rounded-md p-1.5 text-text-muted hover:bg-bg-elevated hover:text-accent-3"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <p className="text-sm font-semibold text-text-primary">{credit.name}</p>
      <p className="text-xs text-text-muted">{credit.institution}</p>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-text-muted">Mensualité</p>
          <p className="font-mono text-text-primary">{formatCents(credit.monthlyPayment)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Capital restant</p>
          <p className="font-mono text-accent-3">{formatCents(credit.remainingAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Taux</p>
          <p className="font-mono text-text-primary">{formatPercent(credit.interestRate * 100)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Fin</p>
          <p className="font-mono text-text-primary">{formatDate(credit.endDate)}</p>
        </div>
      </div>

      <div className="mt-4">
        <ProgressBar
          value={repaidPct}
          label={`Remboursé ${formatCents(repaidAmount)} / ${formatCents(credit.initialAmount)}`}
        />
      </div>

      <Button
        variant="secondary"
        size="sm"
        icon={<Calculator size={14} />}
        className="mt-3 w-full"
        onClick={() => setSimulateOpen(true)}
      >
        Simuler un remboursement anticipé
      </Button>

      <EditCreditDrawer credit={editOpen ? credit : null} open={editOpen} onClose={() => setEditOpen(false)} />
      <RepaymentSimulatorDrawer
        credit={simulateOpen ? credit : null}
        open={simulateOpen}
        onClose={() => setSimulateOpen(false)}
      />
    </Card>
  );
}
