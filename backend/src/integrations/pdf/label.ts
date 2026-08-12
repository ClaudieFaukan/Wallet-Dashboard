/** Uppercased, diacritic-free, letters-only projection of a label — lets a
 * keyword heuristic match "Depot" against "DEPOT" or "L.E.P. EN CPTE" against
 * "LEP" without being tripped up by accents or punctuation. */
export function normalizeLetters(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}
