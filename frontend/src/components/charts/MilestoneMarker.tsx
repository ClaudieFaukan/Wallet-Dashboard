import { CheckCircle2, Circle } from 'lucide-react';
import { chartColors } from './chartTheme';

interface MilestoneMarkerProps {
  label: string;
  reached: boolean;
  date?: string | null;
}

/** Compact milestone chip shown alongside a chart (e.g. investment projection
 * 20K/50K/100K/1M markers) — the vertical marker itself is drawn on the chart
 * via LineChartCard's `milestones` prop (Recharts ReferenceLine). */
export function MilestoneMarker({ label, reached, date }: MilestoneMarkerProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs">
      {reached ? (
        <CheckCircle2 size={16} color={chartColors.accent2} />
      ) : (
        <Circle size={16} color={chartColors.textMuted} />
      )}
      <span className="font-medium text-text-primary">{label}</span>
      {date && <span className="ml-auto font-mono text-text-muted">{date}</span>}
    </div>
  );
}
