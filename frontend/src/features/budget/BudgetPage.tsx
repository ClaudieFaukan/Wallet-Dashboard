import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Tabs } from '../../components/ui/Tabs';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { formatMonth } from '../../lib/format';
import { useCategories } from '../transactions/hooks/useTransactions';
import { MonthlyBudgetView } from './components/MonthlyBudgetView';
import { YearlyHeatmap } from './components/YearlyHeatmap';
import { YearlyBudgetSummary } from './components/YearlyBudgetSummary';
import { useBudgetCurrent } from './hooks/useBudget';

const currentYear = new Date().getFullYear();

/** UTC-based, matching the backend's own month bookkeeping (see project memory:
 * "dates en UTC partout côté backend") — avoids off-by-one months near midnight
 * in timezones behind/ahead of UTC. */
function monthAtOffset(offset: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function BudgetPage() {
  const [view, setView] = useState<'monthly' | 'yearly'>('monthly');
  const [year, setYear] = useState(currentYear);
  const [monthOffset, setMonthOffset] = useState(0);
  const selectedMonth = monthAtOffset(monthOffset);
  const { data: budget } = useBudgetCurrent(selectedMonth);
  const { data: categories } = useCategories();

  return (
    <div>
      <Header title="Budget" />
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between">
          <Tabs
            value={view}
            onChange={setView}
            tabs={[
              { value: 'monthly', label: 'Vue mensuelle' },
              { value: 'yearly', label: 'Vue annuelle' },
            ]}
          />
          {view === 'monthly' && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Mois précédent"
                onClick={() => setMonthOffset((o) => o - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="w-28 text-center text-sm font-medium capitalize text-text-primary">
                {formatMonth(selectedMonth)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Mois suivant"
                onClick={() => setMonthOffset((o) => o + 1)}
              >
                <ChevronRight size={16} />
              </Button>
              {monthOffset !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setMonthOffset(0)}>
                  Aujourd'hui
                </Button>
              )}
            </div>
          )}
          {view === 'yearly' && (
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
        </div>

        {view === 'monthly' && budget && (
          <MonthlyBudgetView budget={budget} categories={categories ?? []} />
        )}
        {view === 'yearly' && (
          <div className="space-y-6">
            <YearlyBudgetSummary year={year} />
            <YearlyHeatmap year={year} />
          </div>
        )}
      </div>
    </div>
  );
}
