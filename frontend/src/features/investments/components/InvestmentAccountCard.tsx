import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Variation } from '../../../components/ui/Variation';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { InvestmentAccount } from '../../../types/api';
import { useDeleteInvestmentAccount } from '../hooks/useInvestments';
import { EditInvestmentAccountDrawer } from './EditInvestmentAccountDrawer';

export function InvestmentAccountCard({
  account,
  allTimeGain,
  allTimeGainPct,
}: {
  account: InvestmentAccount;
  allTimeGain: number | null;
  allTimeGainPct: number | null;
}) {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const deleteAccount = useDeleteInvestmentAccount();
  const toast = useToast();
  const { formatCents } = useFormatCurrency();

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    deleteAccount.mutate(account.id, { onError: (err) => toast.error(getErrorMessage(err)) });
  }

  return (
    <Card
      onClick={() => navigate(`/investments/${account.id}`)}
      className="group relative cursor-pointer transition-colors hover:border-accent-gold/50"
    >
      <div className="absolute right-4 top-4 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title="Éditer"
          onClick={(e) => {
            e.stopPropagation();
            setEditOpen(true);
          }}
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

      <p className="text-sm font-semibold text-text-primary">{account.name}</p>
      {account.platform && <p className="text-xs text-text-muted">{account.platform}</p>}
      <p className="mt-2 font-mono text-lg font-semibold text-text-primary">
        {formatCents(account.currentValue, account.currency)}
      </p>
      {allTimeGain !== null && (
        <div className="mt-1">
          <Variation amountCents={allTimeGain} percent={allTimeGainPct ?? 0} />
        </div>
      )}

      <EditInvestmentAccountDrawer
        account={editOpen ? account : null}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </Card>
  );
}
