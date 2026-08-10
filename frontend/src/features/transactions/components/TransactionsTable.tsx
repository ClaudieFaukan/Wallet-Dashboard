import { Receipt, Trash2 } from 'lucide-react';
import { chartColors } from '../../../components/charts/chartTheme';
import { formatDate } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { Account, Category, Transaction } from '../../../types/api';
import { useDeleteTransaction, useUpdateTransaction } from '../hooks/useTransactions';

interface TransactionsTableProps {
  transactions: Transaction[];
  categories: Category[];
  accountsById: Map<string, Account>;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Aujourd'hui";
  if (key === yesterday) return 'Hier';
  return formatDate(key, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Consecutive same-day runs, trusting the list's existing (server-sorted,
 * most-recent-first) order rather than re-sorting. */
function groupByDay(transactions: Transaction[]): { key: string; items: Transaction[] }[] {
  const groups: { key: string; items: Transaction[] }[] = [];
  for (const t of transactions) {
    const key = dayKey(t.date);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(t);
    else groups.push({ key, items: [t] });
  }
  return groups;
}

export function TransactionsTable({ transactions, categories, accountsById }: TransactionsTableProps) {
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const { formatCents } = useFormatCurrency();
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Receipt size={32} className="text-text-muted" />
        <p className="text-sm text-text-muted">Aucune transaction pour ces filtres.</p>
      </div>
    );
  }

  return (
    <div>
      {groupByDay(transactions).map((group) => (
        <div key={group.key}>
          <p className="px-2 py-2 text-xs font-medium capitalize text-text-muted">{dayLabel(group.key)}</p>
          {group.items.map((t) => {
            const category = t.categoryId ? categoriesById.get(t.categoryId) : undefined;
            const account = accountsById.get(t.accountId);
            const positive = t.amount >= 0;
            return (
              <div
                key={t.id}
                className="group flex items-center gap-4 border-b border-border/50 px-2 py-3 text-sm transition-colors hover:bg-bg-elevated"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: category?.color ?? chartColors.textMuted }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-text-primary">{t.description ?? category?.name ?? 'Sans description'}</p>
                  {account && <p className="truncate text-xs text-text-muted">{account.name}</p>}
                </div>

                <select
                  value={t.categoryId ?? ''}
                  onChange={(e) =>
                    updateTransaction.mutate({
                      id: t.id,
                      input: { categoryId: e.target.value || undefined },
                    })
                  }
                  className="w-36 shrink-0 rounded-md bg-transparent px-1.5 py-1 text-xs text-text-secondary hover:bg-bg-surface hover:text-text-primary focus:outline-none"
                >
                  <option value="">Sans catégorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <span
                  className={`w-28 shrink-0 text-right font-mono font-medium ${positive ? 'text-accent-2' : 'text-accent-3'}`}
                >
                  {positive ? '+' : ''}
                  {formatCents(t.amount, t.currency)}
                </span>

                <button
                  aria-label="Supprimer"
                  onClick={() => deleteTransaction.mutate(t.id)}
                  className="shrink-0 rounded-md p-1.5 text-text-muted opacity-0 transition-opacity hover:bg-bg-surface hover:text-accent-3 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
