import { Card } from '../../../components/ui/Card';
import { LineChartCard } from '../../../components/charts/LineChartCard';
import { chartColors } from '../../../components/charts/chartTheme';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { useBudgetYearly } from '../hooks/useBudget';

const SHORT_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

/** The "prévu vs réel" annual view base.md describes (`GET /budget/:year`) — distinct
 * from `YearlyHeatmap` below, which only shows real spend by category, never the
 * planned amount. */
export function YearlyBudgetSummary({ year }: { year: number }) {
  const { data: months, isLoading } = useBudgetYearly(year);
  const { formatCents } = useFormatCurrency();

  if (isLoading || !months) return <Card>Chargement…</Card>;

  const totalPlanned = months.reduce((sum, m) => sum + m.totalPlanned, 0);
  const totalActual = months.reduce((sum, m) => sum + m.totalActual, 0);
  const variance = totalActual - totalPlanned;

  const chartData = months.map((m) => ({
    label: SHORT_MONTHS[Number(m.month.slice(5, 7)) - 1] ?? m.month,
    Prévu: m.totalPlanned,
    Réel: m.totalActual,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="pr-4">
            <p className="text-sm text-text-secondary">Prévu sur l'année</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(totalPlanned)}
            </p>
          </div>
          <div className="px-4">
            <p className="text-sm text-text-secondary">Réel sur l'année</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {formatCents(totalActual)}
            </p>
          </div>
          <div className="pl-4">
            <p className="text-sm text-text-secondary">{variance <= 0 ? 'Économisé' : 'Dépassement'}</p>
            <p
              className={`mt-1 font-mono text-lg font-semibold ${variance <= 0 ? 'text-accent-2' : 'text-accent-3'}`}
            >
              {formatCents(Math.abs(variance))}
            </p>
          </div>
        </div>
      </Card>

      <LineChartCard
        title="Prévu vs réel par mois"
        data={chartData}
        xKey="label"
        series={[
          { key: 'Prévu', label: 'Prévu', color: chartColors.textMuted },
          { key: 'Réel', label: 'Réel', color: chartColors.accent },
        ]}
        formatValue={(v) => formatCents(v)}
        height={220}
      />
    </div>
  );
}
