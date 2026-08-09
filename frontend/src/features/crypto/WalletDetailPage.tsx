import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Variation } from '../../components/ui/Variation';
import { LineChartCard } from '../../components/charts/LineChartCard';
import { useToast } from '../../components/ui/Toast';
import { getErrorMessage } from '../../lib/api';
import { usdCentsToEurCents } from '../../lib/constants';
import { formatCents, formatDate } from '../../lib/format';
import { useCryptoHistory, useCryptoWallet, useSyncWallet, useWalletTokens } from './hooks/useCrypto';

export function WalletDetailPage() {
  const { id } = useParams<{ id: string }>();
  const walletId = id ?? '';
  const { data: wallet } = useCryptoWallet(walletId);
  const { data: history } = useCryptoHistory(walletId);
  const tokens = useWalletTokens(walletId);
  const sync = useSyncWallet();
  const toast = useToast();
  const latest = history?.[0];

  function handleSync() {
    sync.mutate(walletId, {
      onSuccess: () => toast.success('Wallet synchronisé'),
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  }

  return (
    <div>
      <Header
        title={wallet?.name ?? 'Wallet'}
        actions={
          <Button size="sm" icon={<RefreshCw size={14} />} onClick={handleSync} disabled={sync.isPending}>
            Sync
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        <Card>
          <p className="text-sm text-text-secondary">Valeur totale</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[-0.03em] text-text-primary">
            {latest ? formatCents(usdCentsToEurCents(latest.totalValueUsd)) : '—'}
          </p>
          {latest && <p className="mt-1 text-xs text-text-muted">Mis à jour {formatDate(latest.fetchedAt)}</p>}
        </Card>

        {history && history.length > 1 && (
          <LineChartCard
            title="Valeur — historique"
            data={[...history]
              .reverse()
              .map((s) => ({
                date: formatDate(s.fetchedAt, { day: '2-digit', month: 'short' }),
                value: usdCentsToEurCents(s.totalValueUsd),
              }))}
            xKey="date"
            series={[{ key: 'value', label: 'Valeur' }]}
            formatValue={(v) => formatCents(v)}
            height={240}
          />
        )}

        <Card>
          <h3 className="mb-4 text-sm font-medium text-text-muted">Tokens détenus</h3>

          {tokens.isLoading && <p className="text-sm text-text-muted">Chargement…</p>}
          {tokens.isError && (
            <p className="text-sm text-text-muted">{getErrorMessage(tokens.error)}</p>
          )}
          {tokens.data?.note && <p className="text-sm text-text-muted">{tokens.data.note}</p>}
          {tokens.data && tokens.data.tokens.length === 0 && !tokens.data.note && (
            <p className="text-sm text-text-muted">Aucun token détecté sur cette adresse.</p>
          )}

          {tokens.data && tokens.data.tokens.length > 0 && (
            <div className="divide-y divide-border/50">
              {tokens.data.tokens.map((t) => (
                <div key={t.symbol} className="flex items-center gap-4 py-3 text-sm">
                  <Avatar name={t.name ?? t.symbol} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-text-primary">{t.symbol}</p>
                    {t.name && <p className="truncate text-xs text-text-muted">{t.name}</p>}
                  </div>
                  <div className="w-32 shrink-0 text-right font-mono text-text-secondary">
                    {t.amount.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                  </div>
                  <div className="w-28 shrink-0 text-right font-mono text-text-primary">
                    {t.valueUsdCents !== null ? formatCents(usdCentsToEurCents(t.valueUsdCents)) : '—'}
                  </div>
                  <div className="w-24 shrink-0 text-right">
                    {t.change24hPct !== null ? (
                      <Variation percent={t.change24hPct} />
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
