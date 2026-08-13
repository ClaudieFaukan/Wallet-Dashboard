import { useRef, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Upload } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Variation } from '../../../components/ui/Variation';
import { useToast } from '../../../components/ui/Toast';
import { CircularProgress } from '../../../components/charts/CircularProgress';
import { assetKindColors } from '../../../components/charts/chartTheme';
import { getErrorMessage } from '../../../lib/api';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { PatrimoineRow } from '../../../hooks/usePatrimoineRows';
import { useImportCsv, useSyncRevolut } from '../hooks/useAccounts';

/** Bank-account-only quick actions (Revolut sync, CSV import), shown on
 * hover — the only asset kind these apply to. Kept inline here rather than
 * as a separate menu column so the row stays a single flat component. */
function AccountQuickActions({ accountId }: { accountId: string }) {
  const sync = useSyncRevolut();
  const importCsv = useImportCsv();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSync() {
    sync.mutate(accountId, {
      onSuccess: () => toast.success('Synchronisation Revolut lancée'),
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importCsv.mutate(
      { id: accountId, file },
      {
        onSuccess: (result) =>
          toast.success(`${result.imported} transaction(s) importée(s), ${result.skipped} ignorée(s)`),
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
    e.target.value = '';
  }

  return (
    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
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
    </div>
  );
}

export function AssetRow({ row }: { row: PatrimoineRow }) {
  const { formatCents } = useFormatCurrency();
  const ringColor = assetKindColors[row.kind];

  const nameBlock = (
    <div className="min-w-0">
      <p className="truncate font-medium text-text-primary">{row.name}</p>
      {row.subtitle && <p className="truncate text-xs text-text-muted">{row.subtitle}</p>}
    </div>
  );

  return (
    <div className="group flex items-center gap-4 border-b border-border/50 px-2 py-3.5 text-sm transition-colors hover:bg-bg-elevated">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={row.name} src={row.logoUrl} />
        {row.linkTo ? (
          <Link to={row.linkTo} className="min-w-0 hover:[&_p:first-child]:text-accent-gold">
            {nameBlock}
          </Link>
        ) : (
          nameBlock
        )}
      </div>

      <div className="w-40 shrink-0">
        <Badge variant="neutral">{row.typeLabel}</Badge>
      </div>

      <div className="flex w-24 shrink-0 items-center gap-2">
        <CircularProgress value={row.sharePercent} size={20} strokeWidth={3} color={ringColor} />
        <span className="font-mono text-text-secondary">{row.sharePercent.toFixed(1)}%</span>
      </div>

      <div
        className={`w-28 shrink-0 text-right font-mono font-semibold ${row.isLiability ? 'text-accent-3' : 'text-text-primary'}`}
      >
        {row.isLiability ? '−' : ''}
        {formatCents(row.value)}
      </div>

      <div className="w-32 shrink-0 text-right">
        {row.allTimeGain !== null ? (
          <Variation amountCents={row.allTimeGain} percent={row.allTimeGainPct} className="justify-end" />
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </div>

      <div className="w-32 shrink-0 text-right">
        {row.ytdVariation !== null ? (
          <Variation amountCents={row.ytdVariation} percent={row.ytdVariationPct} className="justify-end" />
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </div>

      <div className="w-[68px] shrink-0">
        {row.kind === 'account' && <AccountQuickActions accountId={row.id} />}
      </div>
    </div>
  );
}
