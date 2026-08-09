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
