import { Trash2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { formatCents, formatDate } from '../../../lib/format';
import type { Category, Transaction } from '../../../types/api';
import { useDeleteTransaction, useUpdateTransaction } from '../hooks/useTransactions';

interface TransactionsTableProps {
  transactions: Transaction[];
  categories: Category[];
}

export function TransactionsTable({ transactions, categories }: TransactionsTableProps) {
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  if (transactions.length === 0) {
    return <p className="py-6 text-sm text-text-muted">Aucune transaction.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-text-muted">
          <th className="py-2 font-medium">Date</th>
          <th className="py-2 font-medium">Description</th>
          <th className="py-2 font-medium">Catégorie</th>
          <th className="py-2 text-right font-medium">Montant</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {transactions.map((t) => (
          <tr key={t.id}>
            <td className="py-2.5 text-text-muted">{formatDate(t.date)}</td>
            <td className="py-2.5 text-text-primary">{t.description ?? '—'}</td>
            <td className="py-2.5">
              <select
                value={t.categoryId ?? ''}
                onChange={(e) =>
                  updateTransaction.mutate({
                    id: t.id,
                    input: { categoryId: e.target.value || undefined },
                  })
                }
                className="rounded-md border border-border bg-bg-elevated px-2 py-1 text-xs text-text-primary"
              >
                <option value="">Sans catégorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </td>
            <td className="py-2.5 text-right">
              <Badge variant={t.amount >= 0 ? 'success' : 'danger'}>
                {formatCents(t.amount, t.currency)}
              </Badge>
            </td>
            <td className="py-2.5 text-right">
              <button
                aria-label="Supprimer"
                onClick={() => deleteTransaction.mutate(t.id)}
                className="text-text-muted hover:text-accent-3"
              >
                <Trash2 size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
