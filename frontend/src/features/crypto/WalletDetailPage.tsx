import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Variation } from '../../components/ui/Variation';
import { LineChartCard } from '../../components/charts/LineChartCard';
import { useToast } from '../../components/ui/Toast';
import { getErrorMessage } from '../../lib/api';
import { USD_TO_EUR_RATE, usdCentsToEurCents } from '../../lib/constants';
import { formatDate } from '../../lib/format';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import type { CryptoCostEntry, WalletToken } from '../../types/api';
import { CostEntryDrawer } from './components/CostEntryDrawer';
import {
  useCostEntries,
  useCryptoHistory,
  useCryptoWallet,
  useDeleteCostEntry,
  useSyncWallet,
  useWalletTokens,
} from './hooks/useCrypto';

export function WalletDetailPage() {
  const { id } = useParams<{ id: string }>();
  const walletId = id ?? '';
  const { data: wallet } = useCryptoWallet(walletId);
  const { data: history } = useCryptoHistory(walletId);
  const tokens = useWalletTokens(walletId);
  const { data: costEntries } = useCostEntries(walletId);
  const sync = useSyncWallet();
  const toast = useToast();
  const { formatCents } = useFormatCurrency();
  const latest = history?.[0];

  const entriesBySymbol = new Map<string, CryptoCostEntry[]>();
  for (const entry of costEntries ?? []) {
    const list = entriesBySymbol.get(entry.symbol) ?? [];
    list.push(entry);
    entriesBySymbol.set(entry.symbol, list);
  }

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
                <TokenRow
                  key={t.symbol}
                  walletId={walletId}
                  token={t}
                  entries={entriesBySymbol.get(t.symbol) ?? []}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function TokenRow({
  walletId,
  token,
  entries,
}: {
  walletId: string;
  token: WalletToken;
  entries: CryptoCostEntry[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [drawerEntry, setDrawerEntry] = useState<CryptoCostEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const deleteCostEntry = useDeleteCostEntry(walletId);
  const toast = useToast();
  const { formatCents } = useFormatCurrency();

  const totalInvestedCents = entries.reduce((sum, e) => sum + e.amountInvestedCents, 0);
  const hasCostBasis = totalInvestedCents > 0;
  const valueEurCents = token.valueUsdCents !== null ? usdCentsToEurCents(token.valueUsdCents) : null;
  const priceEurCents =
    token.priceUsd !== null ? Math.round(token.priceUsd * USD_TO_EUR_RATE * 100) : null;
  const gainCents = hasCostBasis && valueEurCents !== null ? valueEurCents - totalInvestedCents : null;
  const gainPct = gainCents !== null ? (gainCents / totalInvestedCents) * 100 : null;

  function openAddDrawer() {
    setDrawerEntry(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(entry: CryptoCostEntry) {
    setDrawerEntry(entry);
    setDrawerOpen(true);
  }

  function handleDelete(entryId: string) {
    deleteCostEntry.mutate(entryId, { onError: (err) => toast.error(getErrorMessage(err)) });
  }

  return (
    <div className="py-3">
      <div className="flex items-center gap-4 text-sm">
        <Avatar name={token.name ?? token.symbol} src={token.logoUrl} size={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-text-primary">{token.symbol}</p>
          {token.name && <p className="truncate text-xs text-text-muted">{token.name}</p>}
        </div>
        <div className="w-28 shrink-0 text-right font-mono text-text-secondary">
          {token.amount.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
        </div>
        <div className="w-20 shrink-0 text-right font-mono text-xs text-text-muted">
          {priceEurCents !== null ? formatCents(priceEurCents) : '—'}
        </div>
        <div className="w-28 shrink-0 text-right font-mono text-text-primary">
          {valueEurCents !== null ? formatCents(valueEurCents) : '—'}
        </div>
        <div className="w-24 shrink-0 text-right">
          {token.change24hPct !== null ? (
            <Variation percent={token.change24hPct} />
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </div>
        <div className="w-32 shrink-0 text-right">
          {hasCostBasis ? (
            <button
              type="button"
              title="Voir le détail des coûts d'acquisition"
              onClick={() => setExpanded((v) => !v)}
              className="hover:opacity-80"
            >
              {gainCents !== null ? (
                <Variation amountCents={gainCents} percent={gainPct} />
              ) : (
                <span className="text-xs text-text-muted">Investi {formatCents(totalInvestedCents)}</span>
              )}
            </button>
          ) : (
            <button
              type="button"
              title="Ajouter un coût d'acquisition"
              onClick={openAddDrawer}
              className="ml-auto rounded-md p-1.5 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="ml-10 mt-2 space-y-1 border-l border-border/50 pl-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="group flex items-center gap-3 rounded-lg px-1 py-1.5 text-xs hover:bg-bg-elevated/40"
            >
              <span className="w-20 shrink-0 text-text-muted">{formatDate(entry.purchasedAt)}</span>
              <span className="flex-1 truncate text-text-muted">{entry.notes}</span>
              <span className="font-mono text-text-primary">{formatCents(entry.amountInvestedCents)}</span>
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  title="Éditer"
                  onClick={() => openEditDrawer(entry)}
                  className="rounded-md p-1 text-text-muted hover:bg-bg-surface hover:text-text-primary"
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  title="Supprimer"
                  onClick={() => handleDelete(entry.id)}
                  className="rounded-md p-1 text-text-muted hover:bg-bg-surface hover:text-accent-3"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={openAddDrawer} className="text-xs text-accent-gold hover:underline">
            + Ajouter un coût
          </button>
        </div>
      )}

      <CostEntryDrawer
        walletId={walletId}
        symbol={token.symbol}
        entry={drawerEntry}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
