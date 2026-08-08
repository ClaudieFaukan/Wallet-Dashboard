/**
 * Parses a locale-formatted amount string into signed integer cents.
 * `decimalSeparator` is the character used for the decimal point; any other
 * separator character present (grouping) is stripped.
 */
export function parseAmountToCents(raw: string, decimalSeparator: '.' | ','): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  const groupingSeparator = decimalSeparator === '.' ? ',' : '.';
  const normalized = trimmed
    .replaceAll(groupingSeparator, '')
    .replaceAll(decimalSeparator, '.')
    .replace(/[^\d.-]/g, '');

  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid amount: "${raw}"`);
  }

  return Math.round(value * 100);
}
