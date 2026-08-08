import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { chartColors } from './chartTheme';

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
}

export function SparklineChart({ data, color, height = 40 }: SparklineChartProps) {
  const points = data.map((value, i) => ({ i, value }));
  const trendColor =
    color ?? (data.length > 1 && data[data.length - 1]! >= data[0]! ? chartColors.accent2 : chartColors.accent3);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points}>
        <Line type="monotone" dataKey="value" stroke={trendColor} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
