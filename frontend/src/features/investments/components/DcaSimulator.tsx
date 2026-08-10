import { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { LineChartCard } from '../../../components/charts/LineChartCard';
import { MilestoneMarker } from '../../../components/charts/MilestoneMarker';
import { formatDate } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { useProjection } from '../hooks/useInvestments';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue: (value: number) => string;
}

function Slider({ label, value, min, max, step, onChange, formatValue }: SliderProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center justify-between text-text-muted">
        <span>{label}</span>
        <span className="font-mono text-text-primary">{formatValue(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-accent"
      />
    </label>
  );
}

export function DcaSimulator({ accountId }: { accountId: string }) {
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [annualRatePct, setAnnualRatePct] = useState(7);
  const [years, setYears] = useState(10);

  const { data: projection } = useProjection(accountId, {
    monthlyContribution: monthlyContribution * 100,
    annualRate: annualRatePct / 100,
    years,
  });
  const { formatCents } = useFormatCurrency();

  const milestones = (projection?.milestones ?? []).filter((m) => !m.reached);

  return (
    <Card>
      <h3 className="mb-4 text-sm font-medium text-text-muted">Simulateur DCA</h3>
      <div className="grid grid-cols-3 gap-6">
        <Slider
          label="Apport mensuel"
          value={monthlyContribution}
          min={0}
          max={2000}
          step={50}
          onChange={setMonthlyContribution}
          formatValue={(v) => `${v} €`}
        />
        <Slider
          label="Taux annuel"
          value={annualRatePct}
          min={0}
          max={15}
          step={0.5}
          onChange={setAnnualRatePct}
          formatValue={(v) => `${v}%`}
        />
        <Slider
          label="Durée"
          value={years}
          min={1}
          max={30}
          step={1}
          onChange={setYears}
          formatValue={(v) => `${v} ans`}
        />
      </div>

      {projection && (
        <div className="mt-6">
          <LineChartCard
            data={projection.points.map((p) => ({ date: p.date, value: p.value }))}
            xKey="date"
            series={[{ key: 'value', label: 'Valeur projetée' }]}
            formatValue={(v) => formatCents(v)}
            milestones={milestones.map((m) => ({ y: m.amount, label: formatCents(m.amount) }))}
            height={280}
          />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {projection.milestones.map((m) => (
              <MilestoneMarker
                key={m.amount}
                label={formatCents(m.amount)}
                reached={m.reached}
                date={m.estimatedDate ? formatDate(m.estimatedDate, { month: 'short', year: 'numeric' }) : null}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
