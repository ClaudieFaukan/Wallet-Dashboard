import {
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../ui/Card';
import { chartColors, pieColors, tooltipStyle } from './chartTheme';

type ChartRow = Record<string, string | number>;

interface Series {
  key: string;
  label: string;
  color?: string;
}

interface Milestone {
  y: number;
  label: string;
}

interface LineChartCardProps {
  title?: string;
  data: ChartRow[];
  xKey: string;
  series: Series[];
  formatValue?: (value: number) => string;
  milestones?: Milestone[];
  height?: number;
}

export function LineChartCard({
  title,
  data,
  xKey,
  series,
  formatValue = (v) => String(v),
  milestones = [],
  height = 300,
}: LineChartCardProps) {
  return (
    <Card>
      {title && <h3 className="mb-4 text-sm font-medium text-text-muted">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey={xKey}
            stroke={chartColors.textMuted}
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={chartColors.textMuted}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatValue}
            width={70}
          />
          <Tooltip {...tooltipStyle} formatter={(value) => formatValue(Number(value))} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: chartColors.textMuted }} />}
          {milestones.map((m) => (
            <ReferenceLine
              key={m.label}
              y={m.y}
              stroke={chartColors.accent2}
              strokeDasharray="4 4"
              label={{ value: m.label, position: 'right', fill: chartColors.accent2, fontSize: 11 }}
            />
          ))}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? pieColors[i % pieColors.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
