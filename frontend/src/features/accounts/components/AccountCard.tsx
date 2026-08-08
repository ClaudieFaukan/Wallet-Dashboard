import { useRef, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Upload } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { SparklineChart } from '../../../components/charts/SparklineChart';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { formatCents } from '../../../lib/format';
import type { Account } from '../../../types/api';
import { useAccountBalanceHistory, useImportCsv, useSyncRevolut } from '../hooks/useAccounts';

const typeLabels: Record<Account['type'], string> = {
  checking: 'Courant',
  savings: 'Épargne',
  investment: 'Investissement',
};

export function AccountCard({ account }: { account: Account }) {
  const history = useAccountBalanceHistory(account.id, 30);
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
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <Link to={`/accounts/${account.id}`} className="text-sm font-semibold text-text-primary hover:text-accent">
            {account.name}
          </Link>
          <p className="text-xs text-text-muted">
            {typeLabels[account.type]}
            {account.institution ? ` · ${account.institution}` : ''}
          </p>
        </div>
        <p className="font-mono text-lg font-semibold text-text-primary">
          {formatCents(account.balance, account.currency)}
        </p>
      </div>

      <div className="my-3">
        {history.data && history.data.length > 1 && (
          <SparklineChart data={history.data.map((p) => p.balance)} />
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={handleSync} disabled={sync.isPending}>
          Sync Revolut
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="secondary"
          size="sm"
          icon={<Upload size={14} />}
          onClick={() => fileInputRef.current?.click()}
          disabled={importCsv.isPending}
        >
          Import CSV
        </Button>
      </div>
    </Card>
  );
}
