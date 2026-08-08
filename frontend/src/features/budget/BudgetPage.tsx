import { useState } from 'react';
import { Header } from '../../components/layout/Header';
import { Tabs } from '../../components/ui/Tabs';
import { Select } from '../../components/ui/Select';
import { useCategories } from '../transactions/hooks/useTransactions';
import { MonthlyBudgetView } from './components/MonthlyBudgetView';
import { YearlyHeatmap } from './components/YearlyHeatmap';
import { useBudgetCurrent } from './hooks/useBudget';

const currentYear = new Date().getFullYear();

export function BudgetPage() {
  const [view, setView] = useState<'monthly' | 'yearly'>('monthly');
  const [year, setYear] = useState(currentYear);
  const { data: budget } = useBudgetCurrent();
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
        {view === 'yearly' && <YearlyHeatmap year={year} />}
      </div>
    </div>
  );
}
