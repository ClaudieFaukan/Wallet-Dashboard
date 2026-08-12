import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { InvestmentEntry } from '../../../types/api';
import { useDeleteEntry } from '../hooks/useInvestments';
import { EditEntryDrawer } from './EditEntryDrawer';

export function EntriesHistory({ accountId, entries }: { accountId: string; entries: InvestmentEntry[] }) {
  const [editingEntry, setEditingEntry] = useState<InvestmentEntry | null>(null);
  const deleteEntry = useDeleteEntry();
  const toast = useToast();
  const { formatCents } = useFormatCurrency();

  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  function handleDelete(entryId: string) {
    deleteEntry.mutate(
      { id: accountId, entryId },
      { onError: (err) => toast.error(getErrorMessage(err)) },
    );
  }

  return (
    <Card>
      <p className="mb-3 text-sm font-semibold text-text-primary">Historique</p>
      <div className="space-y-1">
        {sorted.map((entry) => (
          <div
            key={entry.id}
            className="group flex items-center gap-4 rounded-lg px-1 py-2 hover:bg-bg-elevated/40"
          >
            <span className="w-24 shrink-0 text-xs text-text-muted">{formatDate(entry.date)}</span>
            <Badge
              variant={
                entry.entryType === 'dividend' ? 'accent' : entry.entryType === 'fee' ? 'danger' : 'neutral'
              }
            >
              {entry.entryType === 'dividend' ? 'Dividende' : entry.entryType === 'fee' ? 'Frais' : 'Versement'}
            </Badge>
            {entry.ticker && <span className="shrink-0 font-mono text-xs text-text-muted">{entry.ticker}</span>}
            <span className="flex-1 text-right font-mono text-sm text-text-primary">
              {formatCents(entry.amountInvested)}
            </span>
            <span className="w-32 shrink-0 text-right font-mono text-xs text-text-muted">
              → {formatCents(entry.portfolioValue)}
            </span>
            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                title="Éditer"
                onClick={() => setEditingEntry(entry)}
                className="rounded-md p-1.5 text-text-muted hover:bg-bg-surface hover:text-text-primary"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                title="Supprimer"
                onClick={() => handleDelete(entry.id)}
                className="rounded-md p-1.5 text-text-muted hover:bg-bg-surface hover:text-accent-3"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <EditEntryDrawer
        accountId={accountId}
        entry={editingEntry}
        open={editingEntry !== null}
        onClose={() => setEditingEntry(null)}
      />
    </Card>
  );
}
