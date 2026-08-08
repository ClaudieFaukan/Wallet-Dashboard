import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '../ui/Card';
import { pieColors, tooltipStyle } from './chartTheme';

interface DonutChartCardProps {
  title?: string;
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
  height?: number;
}

export function DonutChartCard({
  title,
  data,
  formatValue = (v) => String(v),
  height = 240,
}: DonutChartCardProps) {
  const nonZero = data.filter((d) => d.value > 0);

  return (
    <Card>
      {title && <h3 className="mb-4 text-sm font-medium text-text-muted">{title}</h3>}
      {nonZero.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-text-muted">
          Aucune donnée
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="55%" height={height}>
            <PieChart>
              <Pie
                data={nonZero}
                dataKey="value"
                nameKey="label"
                innerRadius="60%"
                outerRadius="90%"
                paddingAngle={2}
              >
                {nonZero.map((entry, i) => (
                  <Cell key={entry.label} fill={pieColors[i % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(value) => formatValue(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="flex flex-1 flex-col gap-2 text-xs">
            {nonZero.map((entry, i) => (
              <li key={entry.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-text-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: pieColors[i % pieColors.length] }}
                  />
                  {entry.label}
                </span>
                <span className="font-mono text-text-primary">{formatValue(entry.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
