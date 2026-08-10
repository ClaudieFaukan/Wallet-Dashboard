import { useState } from 'react';
import { PiggyBank, Plus } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ProgressBar } from '../../../components/charts/ProgressBar';
import { chartColors } from '../../../components/charts/chartTheme';
import { formatMonth } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { BudgetCurrentView, Category } from '../../../types/api';
import { useAddBudgetLine, useUpdateBudgetLine } from '../hooks/useBudget';

function PlannedAmountInput({ lineId, plannedAmount }: { lineId: string; plannedAmount: number }) {
  const [value, setValue] = useState((plannedAmount / 100).toString());
  const update = useUpdateBudgetLine();

  return (
    <input
      type="number"
      step="0.01"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const cents = Math.round(Number(value) * 100);
        if (cents !== plannedAmount) update.mutate({ id: lineId, plannedAmount: cents });
      }}
      className="w-24 rounded-md border border-border bg-bg-elevated px-2 py-1 text-right font-mono text-xs text-text-primary"
    />
  );
}

interface MonthlyBudgetViewProps {
  budget: BudgetCurrentView;
  categories: Category[];
}

export function MonthlyBudgetView({ budget, categories }: MonthlyBudgetViewProps) {
  const [newCategoryId, setNewCategoryId] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);
  const addLine = useAddBudgetLine();
  const { formatCents } = useFormatCurrency();

  const usedCategoryIds = new Set(budget.lines.map((l) => l.categoryId));
  const availableCategories = categories.filter((c) => !usedCategoryIds.has(c.id));
  const availableExpenseCategories = availableCategories.filter((c) => c.type === 'expense');

  async function handleBulkAdd() {
    setBulkAdding(true);
    try {
      for (const category of availableExpenseCategories) {
        await addLine.mutateAsync({ categoryId: category.id, plannedAmount: 0 });
      }
    } finally {
      setBulkAdding(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-muted">
          Prévu {formatCents(budget.totalPlanned)} · Réel {formatCents(budget.totalActual)}
        </h3>
      </div>

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
          {budget.lines.map((line) => (
            <div key={line.id} className="flex items-center gap-4">
              <span className="w-32 shrink-0 text-sm text-text-primary">{line.categoryName}</span>
              <div className="flex-1">
                <ProgressBar
                  value={line.actualAmount}
                  max={Math.max(line.plannedAmount, 1)}
                  color={line.actualAmount > line.plannedAmount ? chartColors.accent3 : chartColors.accent}
                />
              </div>
              <span className="w-20 shrink-0 text-right font-mono text-xs text-text-muted">
                {formatCents(line.actualAmount)}
              </span>
              <PlannedAmountInput lineId={line.id} plannedAmount={line.plannedAmount} />
            </div>
          ))}
        </div>
      )}

      {availableCategories.length > 0 && (
        <div className="mt-5 flex items-end gap-2 border-t border-border pt-4">
          <Select
            label="Ajouter une catégorie"
            value={newCategoryId}
            onChange={(e) => setNewCategoryId(e.target.value)}
            className="w-48"
          >
            <option value="">Choisir…</option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="secondary"
            disabled={!newCategoryId || addLine.isPending}
            onClick={() => {
              addLine.mutate({ categoryId: newCategoryId, plannedAmount: 0 });
              setNewCategoryId('');
            }}
          >
            Ajouter
          </Button>
        </div>
      )}
    </Card>
  );
}
