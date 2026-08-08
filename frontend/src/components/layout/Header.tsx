import type { ReactNode } from 'react';

interface HeaderProps {
  title: string;
  actions?: ReactNode;
}

export function Header({ title, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-8 py-5">
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
