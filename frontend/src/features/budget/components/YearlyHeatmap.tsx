import { Card } from '../../../components/ui/Card';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { useCategoryMonthMatrix } from '../hooks/useBudget';

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export function YearlyHeatmap({ year }: { year: number }) {
  const { byMonth, isLoading } = useCategoryMonthMatrix(year);
  const { formatCents } = useFormatCurrency();

  if (isLoading) return <Card>Chargement…</Card>;

  const categoryNames = new Map<string, string>();
  for (const monthRows of byMonth) {
    for (const row of monthRows) {
      if (row.categoryId) categoryNames.set(row.categoryId, row.categoryName ?? 'Sans catégorie');
    }
  }

  // Only expenses show up meaningfully as spend (amounts are negative cents).
  const spend = (categoryId: string, monthIndex: number) => {
    const row = byMonth[monthIndex]?.find((r) => r.categoryId === categoryId);
    return row ? Math.abs(Math.min(row.total, 0)) : 0;
  };

  const categoryTotal = (categoryId: string) =>
    MONTH_LABELS.reduce((sum, _, i) => sum + spend(categoryId, i), 0);

  const sortedCategoryIds = Array.from(categoryNames.keys()).sort(
    (a, b) => categoryTotal(b) - categoryTotal(a),
  );

  const monthTotal = (monthIndex: number) =>
    sortedCategoryIds.reduce((sum, id) => sum + spend(id, monthIndex), 0);
  const grandTotal = sortedCategoryIds.reduce((sum, id) => sum + categoryTotal(id), 0);

  const maxSpend = Math.max(1, ...sortedCategoryIds.flatMap((id) => MONTH_LABELS.map((_, i) => spend(id, i))));

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left font-medium text-text-muted">Catégorie</th>
              {MONTH_LABELS.map((m) => (
                <th key={m} className="p-1 text-center font-medium text-text-muted">
                  {m}
                </th>
              ))}
              <th className="p-1 text-right font-medium text-text-muted">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedCategoryIds.map((id) => (
              <tr key={id} className="hover:bg-bg-elevated">
                <td className="p-1 text-text-primary">{categoryNames.get(id)}</td>
                {MONTH_LABELS.map((_, i) => {
                  const value = spend(id, i);
                  const intensity = value / maxSpend;
                  return (
                    <td key={i} className="p-1 text-center">
                      <div
                        className="mx-auto flex h-9 w-full items-center justify-center rounded-md font-mono text-[10px] text-text-primary"
                        style={{ backgroundColor: `rgba(201, 168, 76, ${0.08 + intensity * 0.6})` }}
                        title={formatCents(-value)}
                      >
                        {value > 0 ? formatCents(value).replace(',00', '') : ''}
                      </div>
                    </td>
                  );
                })}
                <td className="p-1 text-right font-mono font-medium text-text-primary">
                  {formatCents(categoryTotal(id))}
                </td>
              </tr>
            ))}
            {sortedCategoryIds.length === 0 && (
              <tr>
                <td colSpan={14} className="py-4 text-center text-text-muted">
                  Aucune dépense cette année.
                </td>
              </tr>
            )}
            {sortedCategoryIds.length > 0 && (
              <tr className="border-t border-border font-semibold text-text-primary">
                <td className="p-1">Total</td>
                {MONTH_LABELS.map((_, i) => (
                  <td key={i} className="p-1 text-center font-mono">
                    {formatCents(monthTotal(i)).replace(',00', '')}
                  </td>
                ))}
                <td className="p-1 text-right font-mono">{formatCents(grandTotal)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
