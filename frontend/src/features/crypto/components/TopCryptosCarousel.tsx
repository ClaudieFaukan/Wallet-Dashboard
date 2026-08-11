import { useMemo, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Card } from '../../../components/ui/Card';
import { Variation } from '../../../components/ui/Variation';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { api } from '../../../lib/api';
import { usdCentsToEurCents } from '../../../lib/constants';
import type { CryptoWallet } from '../../../types/api';
import { cryptoKey } from '../hooks/useCrypto';

const MAX_CARDS = 10;

interface CryptoTokenRow {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  valueCents: number;
  totalInvestedCents: number;
  change24hPct: number | null;
}

/** Aggregates individual crypto holdings across every wallet (same ticker held in two
 * wallets is merged), ranked by value — same visual language as the Dashboard's
 * "Ma performance" carousel, but at token granularity instead of account granularity.
 * No sparkline: unlike accounts, we don't store a price history per token (only the
 * latest CoinGecko snapshot), so a chart here would have to be fabricated — same
 * reasoning that kept sparklines off the investments PositionsCard. */
export function TopCryptosCarousel({ wallets }: { wallets: CryptoWallet[] }) {
  const tokenQueries = useQueries({
    queries: wallets.map((w) => ({
      queryKey: [...cryptoKey, w.id, 'tokens'],
      queryFn: () => api.crypto.tokens(w.id),
    })),
  });
  const costQueries = useQueries({
    queries: wallets.map((w) => ({
      queryKey: [...cryptoKey, w.id, 'cost-entries'],
      queryFn: () => api.crypto.listCostEntries(w.id),
    })),
  });

  const isLoading = tokenQueries.some((q) => q.isLoading) || costQueries.some((q) => q.isLoading);

  const rows = useMemo(() => {
    const bySymbol = new Map<string, CryptoTokenRow>();

    for (const q of tokenQueries) {
      for (const t of q.data?.tokens ?? []) {
        if (t.valueUsdCents === null) continue;
        const key = t.symbol.toUpperCase();
        const valueCents = usdCentsToEurCents(t.valueUsdCents);
        const existing = bySymbol.get(key);
        if (existing) {
          existing.valueCents += valueCents;
        } else {
          bySymbol.set(key, {
            symbol: t.symbol,
            name: t.name,
            logoUrl: t.logoUrl,
            valueCents,
            totalInvestedCents: 0,
            change24hPct: t.change24hPct,
          });
        }
      }
    }

    for (const q of costQueries) {
      for (const entry of q.data ?? []) {
        const row = bySymbol.get(entry.symbol.toUpperCase());
        if (row) row.totalInvestedCents += entry.amountInvestedCents;
      }
    }

    return [...bySymbol.values()];
  }, [tokenQueries, costQueries]);

  const ranked = [...rows].sort((a, b) => b.valueCents - a.valueCents).slice(0, MAX_CARDS);

  const scrollerRef = useRef<HTMLDivElement>(null);
  function scrollBy(delta: number) {
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  if (isLoading || ranked.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-muted">Mes cryptos</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollBy(-220)}
            className="rounded-md p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(220)}
            className="rounded-md p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div ref={scrollerRef} className="flex gap-3 overflow-x-auto pb-1">
        {ranked.map((row, i) => (
          <CryptoMoverCard key={row.symbol} row={row} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

function CryptoMoverCard({ row, rank }: { row: CryptoTokenRow; rank: number }) {
  const { formatCents } = useFormatCurrency();
  const hasCostBasis = row.totalInvestedCents > 0;
  const gainCents = hasCostBasis ? row.valueCents - row.totalInvestedCents : null;
  const gainPct = hasCostBasis ? (gainCents! / row.totalInvestedCents) * 100 : row.change24hPct;

  return (
    <Card className="flex w-[190px] shrink-0 flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <Avatar name={row.name ?? row.symbol} src={row.logoUrl} size={28} />
        <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
          #{rank}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">{row.name ?? row.symbol}</p>
        <p className="truncate text-xs text-text-muted">{row.symbol}</p>
      </div>
      <div>
        <p className="font-mono text-sm font-semibold text-text-primary">{formatCents(row.valueCents)}</p>
        {gainPct !== null && (
          <Variation amountCents={gainCents ?? undefined} percent={gainPct} className="text-xs" />
        )}
      </div>
    </Card>
  );
}
