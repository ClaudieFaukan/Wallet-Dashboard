import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Variation } from '../../../components/ui/Variation';
import { useToast } from '../../../components/ui/Toast';
import { SparklineChart } from '../../../components/charts/SparklineChart';
import { getErrorMessage } from '../../../lib/api';
import { usdCentsToEurCents } from '../../../lib/constants';
import { formatDate } from '../../../lib/format';
import { cryptoPlatformLogos } from '../../../lib/institutionLogos';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { CryptoWallet } from '../../../types/api';
import { useCryptoHistory, useDeleteWallet, useSyncWallet } from '../hooks/useCrypto';
import { EditWalletDrawer } from './EditWalletDrawer';

const platformLabels: Record<CryptoWallet['platform'], string> = {
  metamask: 'MetaMask',
  phantom: 'Phantom',
  crypto_com: 'Crypto.com',
  binance: 'Binance',
  bybit: 'Bybit',
  coinbase: 'Coinbase',
  kraken: 'Kraken',
  meria: 'Meria',
};

export function WalletCard({ wallet, ytdVariationPct }: { wallet: CryptoWallet; ytdVariationPct: number | null }) {
  const { data: history, isLoading: historyLoading } = useCryptoHistory(wallet.id);
  const sync = useSyncWallet();
  const deleteWallet = useDeleteWallet();
  const toast = useToast();
  const { formatCents } = useFormatCurrency();
  const [editOpen, setEditOpen] = useState(false);
  const latest = history?.[0];

  function handleSync() {
    sync.mutate(wallet.id, {
      onSuccess: () => toast.success('Wallet synchronisé'),
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    deleteWallet.mutate(wallet.id, { onError: (err) => toast.error(getErrorMessage(err)) });
  }

  return (
    <Card className="group relative p-4">
      <div className="absolute right-3 top-3 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title="Éditer"
          onClick={() => setEditOpen(true)}
          className="rounded-md p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          title="Supprimer"
          onClick={handleDelete}
          className="rounded-md p-1 text-text-muted hover:bg-bg-elevated hover:text-accent-3"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Avatar name={wallet.name} src={cryptoPlatformLogos[wallet.platform]} size={32} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/crypto/${wallet.id}`}
            className="block truncate text-sm font-semibold text-text-primary hover:text-accent-gold"
          >
            {wallet.name}
          </Link>
          <Badge variant="accent">{platformLabels[wallet.platform]}</Badge>
        </div>
        <div className="shrink-0 text-right">
          {historyLoading ? (
            <Skeleton className="ml-auto h-4 w-16" />
          ) : (
            <p className="font-mono text-sm font-semibold text-text-primary">
              {latest ? formatCents(usdCentsToEurCents(latest.totalValueUsd)) : '—'}
            </p>
          )}
          {ytdVariationPct !== null && <Variation percent={ytdVariationPct} className="text-xs" />}
        </div>
      </div>

      {historyLoading ? (
        <Skeleton className="mt-3 h-8 w-full" />
      ) : (
        history &&
        history.length > 1 && (
          <div className="mt-3">
            <SparklineChart
              data={[...history].reverse().map((s) => usdCentsToEurCents(s.totalValueUsd))}
              height={32}
            />
          </div>
        )
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          title="Synchroniser"
          onClick={handleSync}
          disabled={sync.isPending}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-text-secondary hover:bg-bg-elevated hover:text-text-primary disabled:opacity-50"
        >
          <RefreshCw size={12} className={sync.isPending ? 'animate-spin' : ''} />
          Sync
        </button>
        {latest && <span className="text-[10px] text-text-muted">{formatDate(latest.fetchedAt)}</span>}
      </div>

      <EditWalletDrawer wallet={editOpen ? wallet : null} open={editOpen} onClose={() => setEditOpen(false)} />
    </Card>
  );
}
