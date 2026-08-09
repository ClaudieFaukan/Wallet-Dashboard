import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '../ui/Card';
import { pieColors, tooltipStyle } from './chartTheme';

interface DonutChartCardProps {
  title?: string;
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
  centerLabel?: string;
  height?: number;
}

export function DonutChartCard({
  title,
  data,
  formatValue = (v) => String(v),
  centerLabel = 'Total',
  height = 240,
}: DonutChartCardProps) {
  const nonZero = data.filter((d) => d.value > 0);
  const total = nonZero.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      {title && <h3 className="mb-4 text-sm font-medium text-text-muted">{title}</h3>}
      {nonZero.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-text-muted">
          Aucune donnée
        </div>
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative w-[55%] shrink-0">
            <ResponsiveContainer width="100%" height={height}>
              <PieChart>
                <Pie
                  data={nonZero}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="72%"
                  outerRadius="90%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {nonZero.map((entry, i) => (
                    <Cell key={entry.label} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(value) => formatValue(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-lg font-semibold text-text-primary">
                {formatValue(total)}
              </span>
              <span className="text-xs text-text-muted">{centerLabel}</span>
            </div>
          </div>
          <ul className="flex flex-1 flex-col gap-2.5 text-xs">
            {nonZero.map((entry, i) => (
              <li key={entry.label} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-text-primary">
                  <span
                    className="h-1 w-8 shrink-0 rounded-full"
                    style={{ backgroundColor: pieColors[i % pieColors.length] }}
                  />
                  <span className="truncate">{entry.label}</span>
                </span>
                <span className="shrink-0 font-mono text-text-secondary">
                  {formatValue(entry.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
