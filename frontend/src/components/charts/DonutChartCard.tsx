import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '../ui/Card';
import { pieColors, tooltipStyle } from './chartTheme';

interface DonutChartCardProps {
  title?: string;
  data: { label: string; value: number; color?: string }[];
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
  const colorFor = (entry: { color?: string }, i: number) => entry.color ?? pieColors[i % pieColors.length]!;

  return (
    <Card>
      {title && <h3 className="mb-4 text-sm font-medium text-text-muted">{title}</h3>}
      {nonZero.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-text-muted">
          Aucune donnée
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-5">
          <div className="relative w-[55%] shrink-0">
            {/* Chart gets its own stacked z-10 context so its hover tooltip — which can
             * pop up right over the donut's hole — always paints above the center total,
             * not underneath it (the two were fighting for the same spot on hover). */}
            <div className="relative z-10">
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
                      <Cell key={entry.label} fill={colorFor(entry, i)} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(value) => formatValue(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
              <span className="font-mono text-lg font-semibold text-text-primary">
                {formatValue(total)}
              </span>
              <span className="text-xs text-text-muted">{centerLabel}</span>
            </div>
          </div>
          {/* @container: below ~200px of available legend width (typical when this
           * card shares a row with others), each entry stacks label-then-amount on
           * two lines instead of squeezing the category name down to a couple of
           * truncated characters. */}
          <ul className="@container flex min-w-0 flex-1 flex-col gap-2.5 text-xs">
            {nonZero.map((entry, i) => (
              <li
                key={entry.label}
                className="flex min-w-0 flex-col gap-0.5 @[200px]:flex-row @[200px]:items-center @[200px]:justify-between @[200px]:gap-3"
              >
                <span className="flex min-w-0 items-center gap-2 text-text-primary">
                  <span
                    className="h-1 w-8 shrink-0 rounded-full"
                    style={{ backgroundColor: colorFor(entry, i) }}
                  />
                  <span className="truncate">{entry.label}</span>
                </span>
                <span className="shrink-0 pl-10 font-mono text-text-secondary @[200px]:pl-0">
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
