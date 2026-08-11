import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartColors, tooltipStyle } from '../../../components/charts/chartTheme';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';

function daysInMonth(monthValue: string): number {
  const [year, month] = monthValue.slice(0, 7).split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

interface BudgetProgressChartProps {
  /** 'YYYY-MM' or 'YYYY-MM-DD', the budget period being viewed. */
  month: string;
  /** EUR cents — the monthly budget cap, drawn as a horizontal reference line. */
  totalPlanned: number;
  /** EUR cents, one entry per day that had at least one expense. */
  dailySpend: { day: number; amount: number }[];
}

/** Cumulative spend across the month vs. the budget cap — x axis is the day of
 * the month, y axis is in $100 steps, a dashed line marks the monthly budget,
 * and the filled curve creeps toward (or past) it as expenses come in. */
export function BudgetProgressChart({ month, totalPlanned, dailySpend }: BudgetProgressChartProps) {
  const { toDisplayCents, formatCents } = useFormatCurrency();

  const monthStr = month.slice(0, 7);
  const totalDays = daysInMonth(monthStr);
  const now = new Date();
  const currentMonthStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const isFutureMonth = monthStr > currentMonthStr;
  const lastDay = monthStr === currentMonthStr ? now.getUTCDate() : totalDays;

  if (isFutureMonth) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-text-muted">
        Ce mois n'a pas encore commencé.
      </div>
    );
  }

  const spendByDay = new Map(dailySpend.map((d) => [d.day, d.amount]));
  const dayNumbers = Array.from({ length: lastDay }, (_, i) => i + 1);
  const cumulativeByDay = dayNumbers.reduce<number[]>((acc, day) => {
    const previous = acc.length > 0 ? acc[acc.length - 1]! : 0;
    return [...acc, previous + (spendByDay.get(day) ?? 0)];
  }, []);
  const data = dayNumbers.map((day, i) => ({
    day,
    spent: Math.round(toDisplayCents(cumulativeByDay[i]!) / 100),
  }));

  const plannedDisplay = Math.round(toDisplayCents(totalPlanned) / 100);
  const maxSpent = data.length > 0 ? Math.max(...data.map((d) => d.spent)) : 0;
  const yMax = Math.max(100, Math.ceil((Math.max(plannedDisplay, maxSpent) + 1) / 100) * 100);
  const ticks = Array.from({ length: yMax / 100 + 1 }, (_, i) => i * 100);
  const isOverBudget = plannedDisplay > 0 && maxSpent > plannedDisplay;
  const color = isOverBudget ? chartColors.accent3 : chartColors.accent;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="budget-progress-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={chartColors.border} vertical={false} />
        <XAxis
          dataKey="day"
          stroke={chartColors.textMuted}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(d: number) => String(d)}
        />
        <YAxis
          stroke={chartColors.textMuted}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          ticks={ticks}
          domain={[0, yMax]}
          width={56}
          tickFormatter={(v: number) => `${v}`}
        />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(day) => `Jour ${day}`}
          formatter={(value) => [`${formatCents(Number(value) * 100)}`, 'Dépensé']}
        />
        <ReferenceLine
          y={plannedDisplay}
          stroke={chartColors.gold}
          strokeDasharray="4 4"
          label={{
            value: `Budget max (${formatCents(totalPlanned)})`,
            position: 'insideTopRight',
            fill: chartColors.gold,
            fontSize: 11,
          }}
        />
        <Area
          type="monotone"
          dataKey="spent"
          stroke={color}
          strokeWidth={2}
          fill="url(#budget-progress-gradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
