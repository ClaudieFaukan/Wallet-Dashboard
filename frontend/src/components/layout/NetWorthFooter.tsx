import { useNetWorth } from '../../hooks/useNetWorth';
import { formatCompactCents } from '../../lib/format';

export function NetWorthFooter() {
  const { total, isLoading } = useNetWorth();

  return (
    <div className="border-t border-border px-4 py-4">
      <p className="text-[11px] uppercase tracking-wide text-text-muted">Patrimoine net</p>
      <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
        {isLoading ? '—' : formatCompactCents(total)}
      </p>
    </div>
  );
}
