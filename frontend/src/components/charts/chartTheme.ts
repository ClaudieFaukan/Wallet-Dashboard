export const chartColors = {
  accent: '#6366f1',
  accent2: '#10b981',
  accent3: '#f43f5e',
  border: '#2d3148',
  textMuted: '#64748b',
  textPrimary: '#f1f5f9',
  surface: '#1a1d27',
};

export const pieColors = [
  '#6366f1',
  '#10b981',
  '#f43f5e',
  '#f59e0b',
  '#0ea5e9',
  '#a855f7',
  '#ec4899',
  '#84cc16',
];

export const tooltipStyle = {
  contentStyle: {
    backgroundColor: chartColors.surface,
    border: `1px solid ${chartColors.border}`,
    borderRadius: 8,
    fontSize: 12,
    color: chartColors.textPrimary,
  },
  itemStyle: { color: chartColors.textPrimary },
  labelStyle: { color: chartColors.textMuted },
};
