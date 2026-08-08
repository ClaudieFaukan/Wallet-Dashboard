export function formatCents(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
}

export function formatCompactCents(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

export function formatDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(
    'fr-FR',
    options ?? { day: '2-digit', month: 'short', year: 'numeric' },
  ).format(new Date(iso));
}

export function formatMonth(monthValue: string): string {
  // Accepts 'YYYY-MM' or a full ISO date and formats as "janv. 2026".
  const iso = monthValue.length === 7 ? `${monthValue}-01` : monthValue;
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(
    new Date(iso),
  );
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}
