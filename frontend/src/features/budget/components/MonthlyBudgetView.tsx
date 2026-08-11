import { useState, type FormEvent } from 'react';
import { PiggyBank, Plus, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { useToast } from '../../../components/ui/Toast';
import { ProgressBar } from '../../../components/charts/ProgressBar';
import { DonutChartCard } from '../../../components/charts/DonutChartCard';
import { chartColors } from '../../../components/charts/chartTheme';
import { BudgetProgressChart } from './BudgetProgressChart';
import { formatMonth } from '../../../lib/format';
import { getErrorMessage } from '../../../lib/api';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { BudgetCurrentView, Category } from '../../../types/api';
import { useAddBudgetLine, useDeleteBudgetLine, useUpdateBudgetLine } from '../hooks/useBudget';

/** `plannedAmount` is stored in EUR cents; the field itself is shown and edited in
 * whatever currency is currently selected (`displayCurrency`) — typing "100" while
 * set to USD now means $100, not €100 silently reinterpreted as dollars. The parent
 * remounts this component (via `key`) when `displayCurrency` changes so the shown
 * value re-converts instead of going stale. */
function PlannedAmountInput({ lineId, plannedAmount }: { lineId: string; plannedAmount: number }) {
  const { displayCurrency, toDisplayCents, fromDisplayCents } = useFormatCurrency();
  const initialValue = (toDisplayCents(plannedAmount) / 100).toString();
  const [value, setValue] = useState(initialValue);
  const update = useUpdateBudgetLine();

  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-text-muted">
      Prévu ({displayCurrency})
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          // Compare against the untouched display string, not a round-tripped EUR
          // value — converting EUR→display→EUR can drift by a cent from double
          // rounding, which would otherwise fire a spurious PATCH on every blur.
          if (value === initialValue) return;
          const eurCents = fromDisplayCents(Math.round(Number(value) * 100));
          if (eurCents !== plannedAmount) update.mutate({ id: lineId, plannedAmount: eurCents });
        }}
        className="w-20 rounded-md border border-border bg-bg-elevated px-2 py-1 text-right font-mono text-xs text-text-primary"
      />
    </label>
  );
}

function AddCategoryModal({
  open,
  onClose,
  categories,
  month,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  month: string;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const addLine = useAddBudgetLine();
  const toast = useToast();
  const { displayCurrency, fromDisplayCents } = useFormatCurrency();

  function reset() {
    setCategoryId('');
    setAmount('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const eurCents = fromDisplayCents(Math.round((Number(amount) || 0) * 100));
    addLine.mutate(
      { categoryId, plannedAmount: eurCents, month },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Ajouter une catégorie au budget">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Catégorie"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
        >
          <option value="">Choisir…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          label={`Montant prévu (${displayCurrency})`}
          type="number"
          step="0.01"
          min="0"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button type="submit" disabled={!categoryId || addLine.isPending}>
          {addLine.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
      </form>
    </Modal>
  );
}

interface MonthlyBudgetViewProps {
  budget: BudgetCurrentView;
  categories: Category[];
}

export function MonthlyBudgetView({ budget, categories }: MonthlyBudgetViewProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const addLine = useAddBudgetLine();
  const deleteLine = useDeleteBudgetLine();
  const toast = useToast();
  const { formatCents, displayCurrency } = useFormatCurrency();
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const month = budget.month.slice(0, 7);

  const usedCategoryIds = new Set(budget.lines.map((l) => l.categoryId));
  const availableCategories = categories.filter((c) => !usedCategoryIds.has(c.id));
  const availableExpenseCategories = availableCategories.filter((c) => c.type === 'expense');
  const sortedLines = [...budget.lines].sort((a, b) => b.actualAmount - a.actualAmount);
  const remaining = budget.totalPlanned - budget.totalActual;

  async function handleBulkAdd() {
    setBulkAdding(true);
    try {
      for (const category of availableExpenseCategories) {
        await addLine.mutateAsync({ categoryId: category.id, plannedAmount: 0, month });
      }
    } finally {
      setBulkAdding(false);
    }
  }

  const donutData = budget.lines
    .filter((l) => l.actualAmount > 0)
    .map((l) => ({
      label: l.categoryName,
      value: l.actualAmount,
      color: categoriesById.get(l.categoryId)?.color ?? undefined,
    }));

  return (
    <div className="space-y-4">
      {budget.lines.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2">
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="pr-4">
                <p className="text-sm text-text-secondary">Prévu</p>
                <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                  {formatCents(budget.totalPlanned)}
                </p>
              </div>
              <div className="px-4">
                <p className="text-sm text-text-secondary">Réel</p>
                <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                  {formatCents(budget.totalActual)}
                </p>
              </div>
              <div className="pl-4">
                <p className="text-sm text-text-secondary">{remaining >= 0 ? 'Reste' : 'Dépassement'}</p>
                <p
                  className={`mt-1 font-mono text-lg font-semibold ${remaining >= 0 ? 'text-accent-2' : 'text-accent-3'}`}
                >
                  {formatCents(Math.abs(remaining))}
                </p>
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <BudgetProgressChart month={budget.month} totalPlanned={budget.totalPlanned} dailySpend={budget.dailySpend} />
            </div>
          </Card>
          <DonutChartCard title="Répartition des dépenses" data={donutData} formatValue={(v) => formatCents(v)} />
        </div>
      )}

      <Card>
        {budget.lines.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <PiggyBank size={32} className="text-text-muted" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                Aucun budget pour {formatMonth(budget.month)}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Commencez par ajouter vos catégories de dépenses.
              </p>
            </div>
            {availableExpenseCategories.length > 0 && (
              <Button
                size="sm"
                icon={<Plus size={14} />}
                onClick={handleBulkAdd}
                disabled={bulkAdding}
              >
                {bulkAdding
                  ? 'Création…'
                  : `Créer le budget de ${formatMonth(budget.month)}`}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedLines.map((line) => {
              const over = line.actualAmount > line.plannedAmount;
              const lineRemaining = line.plannedAmount - line.actualAmount;
              return (
                <div key={line.id} className="group flex items-center gap-4">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: categoriesById.get(line.categoryId)?.color ?? chartColors.textMuted }}
                  />
                  <span className="w-32 shrink-0 truncate text-sm text-text-primary">{line.categoryName}</span>
                  <div className="flex-1">
                    <ProgressBar
                      value={line.actualAmount}
                      max={Math.max(line.plannedAmount, 1)}
                      label={`${formatCents(line.actualAmount)} / ${formatCents(line.plannedAmount)}`}
                      color={over ? chartColors.accent3 : chartColors.accent}
                    />
                  </div>
                  <span
                    className={`w-32 shrink-0 text-right text-xs ${over ? 'text-accent-3' : 'text-text-muted'}`}
                  >
                    {over ? `Dépassé de ${formatCents(-lineRemaining)}` : `Reste ${formatCents(lineRemaining)}`}
                  </span>
                  <PlannedAmountInput
                    key={displayCurrency}
                    lineId={line.id}
                    plannedAmount={line.plannedAmount}
                  />
                  <button
                    aria-label="Supprimer la ligne de budget"
                    onClick={() =>
                      deleteLine.mutate(line.id, { onError: (err) => toast.error(getErrorMessage(err)) })
                    }
                    className="shrink-0 rounded-md p-1.5 text-text-muted opacity-0 transition-opacity hover:bg-bg-surface hover:text-accent-3 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {availableCategories.length > 0 && (
          <div className="mt-5 flex justify-center border-t border-border pt-4">
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus size={14} />}
              onClick={() => setAddModalOpen(true)}
            >
              Ajouter une catégorie
            </Button>
          </div>
        )}
      </Card>

      <AddCategoryModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        categories={availableCategories}
        month={month}
      />
    </div>
  );
}
