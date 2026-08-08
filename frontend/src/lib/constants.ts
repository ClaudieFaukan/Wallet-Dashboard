// Best-effort fixed rate — the app has no live FX service. Only used to fold
// crypto wallet values (stored in USD) into the EUR-denominated net worth.
export const USD_TO_EUR_RATE = 0.92;

export function usdCentsToEurCents(usdCents: number): number {
  return Math.round(usdCents * USD_TO_EUR_RATE);
}
