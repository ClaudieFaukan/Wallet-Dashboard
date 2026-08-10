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

  const maxSpend = Math.max(
    1,
    ...Array.from(categoryNames.keys()).flatMap((id) =>
      MONTH_LABELS.map((_, i) => spend(id, i)),
    ),
  );

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
            </tr>
          </thead>
          <tbody>
            {Array.from(categoryNames.entries()).map(([id, name]) => (
              <tr key={id}>
                <td className="p-1 text-text-primary">{name}</td>
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
              </tr>
            ))}
            {categoryNames.size === 0 && (
              <tr>
                <td colSpan={13} className="py-4 text-center text-text-muted">
                  Aucune dépense cette année.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
