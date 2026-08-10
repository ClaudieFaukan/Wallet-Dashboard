import type { ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../ui/Card';
import { chartColors, tooltipStyle } from './chartTheme';

interface AreaChartCardProps {
  title?: string;
  header?: ReactNode;
  actions?: ReactNode;
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
  color?: string;
  height?: number;
  className?: string;
}

export function AreaChartCard({
  title,
  header,
  actions,
  data,
  formatValue = (v) => String(v),
  color = chartColors.gold,
  height = 260,
  className = '',
}: AreaChartCardProps) {
  const gradientId = `area-gradient-${color.replace('#', '')}`;

  return (
    <Card className={className}>
      {(title ?? header ?? actions) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-medium text-text-muted">{title}</h3>}
            {header}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
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
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
