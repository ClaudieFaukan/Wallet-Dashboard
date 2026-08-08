import { chartColors } from './chartTheme';

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

export function CircularProgress({
  value,
  max = 100,
  size = 96,
  strokeWidth = 8,
  color,
  label,
}: CircularProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const strokeColor = color ?? (pct >= 100 ? chartColors.accent2 : chartColors.accent);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={chartColors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="font-mono text-sm font-semibold text-text-primary">{Math.round(pct)}%</span>
        {label && <span className="text-[10px] text-text-muted">{label}</span>}
      </div>
    </div>
  );
}
