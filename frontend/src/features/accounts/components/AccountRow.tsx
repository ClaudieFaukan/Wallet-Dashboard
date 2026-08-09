import { useRef, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, RefreshCw, Upload } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { CircularProgress } from '../../../components/charts/CircularProgress';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { formatCents } from '../../../lib/format';
import type { Account } from '../../../types/api';
import { useImportCsv, useSyncRevolut } from '../hooks/useAccounts';

const typeLabels: Record<Account['type'], string> = {
  checking: 'Comptes courants',
  savings: 'Comptes d’épargne',
  investment: 'Comptes d’investissement',
};

export function AccountRow({ account, sharePercent }: { account: Account; sharePercent: number }) {
  const sync = useSyncRevolut();
  const importCsv = useImportCsv();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSync() {
    sync.mutate(account.id, {
      onSuccess: () => toast.success('Synchronisation Revolut lancée'),
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importCsv.mutate(
      { id: account.id, file },
      {
        onSuccess: (result) =>
          toast.success(`${result.imported} transaction(s) importée(s), ${result.skipped} ignorée(s)`),
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
    e.target.value = '';
  }

  return (
    <div className="group flex items-center gap-4 border-b border-border/50 px-2 py-3.5 text-sm transition-colors hover:bg-bg-elevated">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={account.institution ?? account.name} />
        <div className="min-w-0">
          <Link
            to={`/accounts/${account.id}`}
            className="block truncate font-medium text-text-primary hover:text-accent-gold"
          >
            {account.name}
          </Link>
          {account.institution && (
            <p className="truncate text-xs text-text-muted">{account.institution}</p>
          )}
        </div>
      </div>

      <div className="w-44 shrink-0">
        <Badge variant="neutral">{typeLabels[account.type]}</Badge>
      </div>

      <div className="flex w-24 shrink-0 items-center gap-2">
        <CircularProgress value={sharePercent} size={20} strokeWidth={3} />
        <span className="font-mono text-text-secondary">{sharePercent.toFixed(1)}%</span>
      </div>

      <div className="w-28 shrink-0 text-right font-mono font-semibold text-text-primary">
        {formatCents(account.balance, account.currency)}
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          title="Synchroniser Revolut"
          onClick={handleSync}
          disabled={sync.isPending}
          className="rounded-md p-1.5 text-text-muted hover:bg-bg-surface hover:text-text-primary"
        >
          <RefreshCw size={14} />
        </button>
        <button
          type="button"
          title="Importer un CSV"
          onClick={() => fileInputRef.current?.click()}
          disabled={importCsv.isPending}
          className="rounded-md p-1.5 text-text-muted hover:bg-bg-surface hover:text-text-primary"
        >
          <Upload size={14} />
        </button>
        <button
          type="button"
          title="Plus d'options"
          className="rounded-md p-1.5 text-text-muted hover:bg-bg-surface hover:text-text-primary"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    </div>
  );
}
