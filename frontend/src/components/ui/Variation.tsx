import { formatPercent } from '../../lib/format';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

interface VariationProps {
  amountCents?: number;
  percent?: number | null;
  currency?: string;
  className?: string;
}

/** Finary-style variation label: "+68 € ▲ 3,59%" in green, or the red/▼
 * equivalent when negative. Pass only `percent` for a percent-only variant
 * (e.g. a 24h token price change with no absolute amount). */
export function Variation({ amountCents, percent, currency = 'EUR', className = '' }: VariationProps) {
  const { formatCents } = useFormatCurrency();
  const positive = (amountCents ?? percent ?? 0) >= 0;
  const color = positive ? 'text-accent-2' : 'text-accent-3';
  const arrow = positive ? '▲' : '▼';

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm ${color} ${className}`}>
      {amountCents !== undefined && (
        <span>
          {positive ? '+' : ''}
          {formatCents(amountCents, currency)}
        </span>
      )}
      {percent !== undefined && percent !== null && (
        <span>
          {arrow} {formatPercent(Math.abs(percent))}
        </span>
      )}
    </span>
  );
}
