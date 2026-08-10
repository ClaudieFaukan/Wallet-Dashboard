import { useUiStore } from '../store/uiStore';
import { formatCents, formatCompactCents } from '../lib/format';
import { useExchangeRates } from './useExchangeRates';

/** All amounts are stored/computed in EUR cents app-wide (see project memory) — this
 * hook is the single place that converts to the user's chosen display currency before
 * formatting. Everything else keeps calling formatCents/formatCompactCents by name,
 * just sourced from this hook instead of the raw `lib/format` import, so the amount
 * still re-renders correctly when the display currency changes. */
export function useFormatCurrency() {
  const displayCurrency = useUiStore((s) => s.displayCurrency);
  const { data: rates } = useExchangeRates();

  function convert(cents: number, sourceCurrency: string): number {
    if (sourceCurrency === displayCurrency) return cents;
    if (sourceCurrency !== 'EUR') return cents; // no rate path for a non-EUR source, leave as-is
    const rate = rates?.rates[displayCurrency];
    if (!rate) return cents;
    return Math.round(cents * rate);
  }

  return {
    displayCurrency,
    formatCents: (cents: number, sourceCurrency = 'EUR') =>
      formatCents(convert(cents, sourceCurrency), displayCurrency),
    formatCompactCents: (cents: number, sourceCurrency = 'EUR') =>
      formatCompactCents(convert(cents, sourceCurrency), displayCurrency),
  };
}
