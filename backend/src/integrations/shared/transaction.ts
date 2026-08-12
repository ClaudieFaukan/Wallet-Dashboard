import crypto from 'node:crypto';

export interface ParsedTransaction {
  date: Date;
  amountCents: number;
  description: string;
  type: 'income' | 'expense';
  externalId: string;
}

export function computeExternalId(date: Date, amountCents: number, description: string): string {
  const key = `${date.toISOString()}|${amountCents}|${description}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function toTransaction(date: Date, amountCents: number, description: string): ParsedTransaction {
  return {
    date,
    amountCents,
    description,
    type: amountCents > 0 ? 'income' : 'expense',
    externalId: computeExternalId(date, amountCents, description),
  };
}

/**
 * Two distinct real transactions can share the exact same date, amount and
 * description (e.g. two identical train tickets bought back to back) and
 * would otherwise collapse onto the same `externalId`, violating the
 * database's per-account uniqueness constraint the moment both land in the
 * same insert batch. Every occurrence after the first gets a salted id so
 * they're both kept — the first occurrence's id is left untouched so
 * previously-imported transactions still dedupe correctly against it on
 * re-import.
 */
export function disambiguateDuplicates(transactions: ParsedTransaction[]): ParsedTransaction[] {
  const occurrences = new Map<string, number>();
  return transactions.map((t) => {
    const count = occurrences.get(t.externalId) ?? 0;
    occurrences.set(t.externalId, count + 1);
    if (count === 0) return t;
    return {
      ...t,
      externalId: computeExternalId(t.date, t.amountCents, `${t.description}#${count}`),
    };
  });
}
