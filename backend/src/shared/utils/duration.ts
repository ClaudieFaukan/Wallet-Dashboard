const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses a simple duration string like "15m" or "7d" into milliseconds. */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match?.[1] || !match[2]) throw new Error(`Invalid duration format: ${value}`);
  return Number(match[1]) * UNIT_MS[match[2]]!;
}
