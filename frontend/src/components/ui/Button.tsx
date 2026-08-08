import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent/90',
  secondary: 'bg-bg-elevated text-text-primary hover:bg-bg-elevated/80 border border-border',
  ghost: 'bg-transparent text-text-muted hover:text-text-primary hover:bg-bg-elevated',
  danger: 'bg-accent-3/10 text-accent-3 hover:bg-accent-3/20 border border-accent-3/30',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
