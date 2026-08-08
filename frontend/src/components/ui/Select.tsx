import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = '', children, id, ...props }: SelectProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-text-primary">{label}</span>}
      <select
        id={id}
        className={`rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
