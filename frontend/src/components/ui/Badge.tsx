import type { ReactNode } from 'react';

type Variant = 'success' | 'danger' | 'neutral' | 'accent';

const variantClasses: Record<Variant, string> = {
  success: 'bg-accent-2/10 text-accent-2',
  danger: 'bg-accent-3/10 text-accent-3',
  neutral: 'bg-bg-elevated text-text-muted',
  accent: 'bg-accent/10 text-accent',
};

export function Badge({ variant = 'neutral', children }: { variant?: Variant; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
