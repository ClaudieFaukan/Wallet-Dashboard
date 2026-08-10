export const chartColors = {
  accent: '#6366f1',
  gold: '#c9a84c',
  accent2: '#22c55e',
  accent3: '#ef4444',
  border: '#1e1e2e',
  borderHover: '#2a2a3e',
  textMuted: '#52526e',
  textSecondary: '#a0a0b8',
  textPrimary: '#ffffff',
  surface: '#111118',
  elevated: '#1a1a24',
};

export const pieColors = [
  '#c9a84c',
  '#6366f1',
  '#22c55e',
  '#ef4444',
  '#0ea5e9',
  '#a855f7',
  '#ec4899',
  '#f59e0b',
  '#14b8a6',
  '#84cc16',
];

/** Muted neutral used for the "Autre" catch-all slice grouping small items
 * beyond the top N in a donut, so it never competes visually with real data. */
export const otherColor = '#3a3a4a';

export type AssetKind = 'account' | 'investment' | 'crypto' | 'real_estate' | 'collectibles' | 'credit';

/** Stable color per asset category, used for type badges/icons so the same
 * kind of asset always reads the same hue across pages (donut slices stay
 * per-item/positional — see DonutChartCard — this is for smaller accents). */
export const assetKindColors: Record<AssetKind, string> = {
  account: chartColors.accent,
  investment: '#14b8a6',
  crypto: '#a855f7',
  real_estate: '#f59e0b',
  collectibles: '#ec4899',
  credit: chartColors.accent3,
};

export const tooltipStyle = {
  contentStyle: {
    backgroundColor: chartColors.elevated,
    border: `1px solid ${chartColors.borderHover}`,
    borderRadius: 8,
    fontSize: 12,
    color: chartColors.textPrimary,
  },
  itemStyle: { color: chartColors.textPrimary },
  labelStyle: { color: chartColors.textSecondary },
};
