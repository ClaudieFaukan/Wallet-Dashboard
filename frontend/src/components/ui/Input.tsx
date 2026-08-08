import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-text-primary">{label}</span>}
      <input
        id={id}
        className={`rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-accent-3">{error}</span>}
    </label>
  );
}
