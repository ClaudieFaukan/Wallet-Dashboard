import { chartColors } from './chartTheme';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  color?: string;
}

export function ProgressBar({ value, max = 100, label, color }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = color ?? (pct >= 100 ? chartColors.accent2 : chartColors.accent);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{label}</span>
          <span className="font-mono">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}
