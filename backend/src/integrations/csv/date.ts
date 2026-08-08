const FRENCH_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Parses either ISO (YYYY-MM-DD[...]) or French (DD/MM/YYYY) dates from bank exports. */
export function parseDate(raw: string): Date {
  const trimmed = raw.trim();

  const frenchMatch = FRENCH_DATE.exec(trimmed);
  if (frenchMatch?.[1] && frenchMatch[2] && frenchMatch[3]) {
    const [, day, month, year] = frenchMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: "${raw}"`);
  }
  return parsed;
}
