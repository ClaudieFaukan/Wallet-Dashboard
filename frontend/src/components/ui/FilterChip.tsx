import type { ReactNode } from 'react';

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** Small pill toggle used for single-select type/category filters — the
 * quick "tap to narrow" alternative to a Select dropdown when there are only
 * a handful of options worth showing all at once. */
export function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-accent-gold bg-accent-gold/10 text-accent-gold'
          : 'border-border text-text-secondary hover:border-border-hover'
      }`}
    >
      {children}
    </button>
  );
}
