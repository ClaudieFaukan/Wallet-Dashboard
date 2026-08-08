import { RefreshCw } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { LineChartCard } from '../../../components/charts/LineChartCard';
import { getErrorMessage } from '../../../lib/api';
import { usdCentsToEurCents } from '../../../lib/constants';
import { formatCents, formatDate, truncateAddress } from '../../../lib/format';
import type { CryptoWallet } from '../../../types/api';
import { useCryptoHistory, useSyncWallet } from '../hooks/useCrypto';

const platformLabels: Record<CryptoWallet['platform'], string> = {
  metamask: 'MetaMask',
  phantom: 'Phantom',
  crypto_com: 'Crypto.com',
};

export function WalletCard({ wallet }: { wallet: CryptoWallet }) {
  const { data: history } = useCryptoHistory(wallet.id);
  const sync = useSyncWallet();
  const toast = useToast();
  const latest = history?.[0];

  function handleSync() {
    sync.mutate(wallet.id, {
      onSuccess: () => toast.success('Wallet synchronisé'),
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">{wallet.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="accent">{platformLabels[wallet.platform]}</Badge>
            <span className="font-mono text-xs text-text-muted">{truncateAddress(wallet.address)}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-semibold text-text-primary">
            {latest ? formatCents(usdCentsToEurCents(latest.totalValueUsd)) : '—'}
          </p>
          {latest && <p className="text-[11px] text-text-muted">{formatDate(latest.fetchedAt)}</p>}
        </div>
      </div>

      {history && history.length > 1 && (
        <div className="mt-4">
          <LineChartCard
            data={[...history]
              .reverse()
              .map((s) => ({ date: formatDate(s.fetchedAt, { day: '2-digit', month: 'short' }), value: usdCentsToEurCents(s.totalValueUsd) }))}
            xKey="date"
            series={[{ key: 'value', label: 'Valeur' }]}
            formatValue={(v) => formatCents(v)}
            height={160}
          />
        </div>
      )}

      <Button
        variant="secondary"
        size="sm"
        icon={<RefreshCw size={14} />}
        className="mt-3"
        onClick={handleSync}
        disabled={sync.isPending}
      >
        Sync
      </Button>
    </Card>
  );
}
