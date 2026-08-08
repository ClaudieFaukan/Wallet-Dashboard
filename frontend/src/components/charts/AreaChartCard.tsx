import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../ui/Card';
import { chartColors, tooltipStyle } from './chartTheme';

interface AreaChartCardProps {
  title?: string;
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
  color?: string;
  height?: number;
}

export function AreaChartCard({
  title,
  data,
  formatValue = (v) => String(v),
  color = chartColors.accent,
  height = 260,
}: AreaChartCardProps) {
  const gradientId = `area-gradient-${color.replace('#', '')}`;

  return (
    <Card>
      {title && <h3 className="mb-4 text-sm font-medium text-text-muted">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
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
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
