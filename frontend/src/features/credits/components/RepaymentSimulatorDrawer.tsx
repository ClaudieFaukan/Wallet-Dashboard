import { useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { LineChartCard } from '../../../components/charts/LineChartCard';
import { formatDate } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { Credit } from '../../../types/api';
import { useCreditSimulation } from '../hooks/useCredits';

function StatBlock({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' }) {
  const toneClass = tone === 'positive' ? 'text-accent-2' : tone === 'negative' ? 'text-accent-3' : 'text-text-primary';
  return (
    <div className="rounded-lg bg-bg-elevated p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-1 font-mono text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export function RepaymentSimulatorDrawer({
  credit,
  open,
  onClose,
}: {
  credit: Credit | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={credit ? `Simuler — ${credit.name}` : 'Simuler'}>
      {credit && <SimulatorBody credit={credit} />}
    </Drawer>
  );
}

function SimulatorBody({ credit }: { credit: Credit }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const earlyRepaymentDate = date ? new Date(date).toISOString() : '';
  const { data: sim, isLoading } = useCreditSimulation(credit.id, earlyRepaymentDate);
  const { formatCents } = useFormatCurrency();

  const chartData = (sim?.points ?? []).map((p) => ({
    date: formatDate(p.date, { month: 'short', year: '2-digit' }),
    doNothing: p.doNothing,
    earlyRepayment: p.earlyRepayment,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Date de remboursement anticipé"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        min={new Date().toISOString().slice(0, 10)}
        max={credit.endDate.slice(0, 10)}
      />

      {isLoading && <p className="text-sm text-text-muted">Calcul…</p>}

      {sim && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatBlock label="Restant dû à cette date" value={formatCents(sim.totalRemaining)} />
            <StatBlock label="Intérêts économisés" value={formatCents(sim.interestSaved)} tone="positive" />
            <StatBlock label="Frais de remboursement" value={formatCents(sim.earlyRepaymentFee)} tone="negative" />
            <StatBlock
              label="Gain net"
              value={formatCents(sim.netGain)}
              tone={sim.netGain >= 0 ? 'positive' : 'negative'}
            />
            <StatBlock label="Mensualité libérée" value={formatCents(sim.freedMonthlyBudget)} />
            <StatBlock
              label="Valeur projetée investie (7 %/an)"
              value={formatCents(sim.investmentProjection)}
              tone="positive"
            />
          </div>

          <LineChartCard
            title="Ne rien faire vs rembourser + investir"
            data={chartData}
            xKey="date"
            series={[
              { key: 'doNothing', label: 'Ne rien faire' },
              { key: 'earlyRepayment', label: 'Rembourser + investir' },
            ]}
            formatValue={(v) => formatCents(v)}
            height={260}
          />
        </>
      )}
    </div>
  );
}
