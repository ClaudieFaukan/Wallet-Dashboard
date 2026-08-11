import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
  title: string;
  actions?: ReactNode;
  backTo?: string;
}

export function Header({ title, actions, backTo }: HeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-8 py-5">
      <div className="flex items-center gap-3">
        {backTo && (
          <Link
            to={backTo}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
            aria-label="Retour"
          >
            <ArrowLeft size={16} />
          </Link>
        )}
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
