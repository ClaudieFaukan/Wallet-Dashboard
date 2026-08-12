import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Variation } from '../../../components/ui/Variation';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import { formatPercent } from '../../../lib/format';
import { useExchangeRates } from '../../../hooks/useExchangeRates';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { InvestmentAssetType, InvestmentEntry, StockQuote } from '../../../types/api';
import { useStockQuotes, useUpdateInvestmentAccount } from '../hooks/useInvestments';
import { PositionDetailModal } from './PositionDetailModal';

interface Holding {
  ticker: string;
  assetType: InvestmentAssetType | null;
  isin: string | null;
  totalShares: number | null;
  totalInvested: number;
  totalDividends: number;
}

export interface PositionRow extends Holding {
  quote: StockQuote | undefined;
  marketValueEur: number | null;
  gainPct: number | null;
}

function buildHoldings(entries: InvestmentEntry[]): Holding[] {
  const byTicker = new Map<string, Holding>();
  for (const e of entries) {
    if (!e.ticker) continue;
    const existing = byTicker.get(e.ticker) ?? {
      ticker: e.ticker,
      assetType: null,
      isin: null,
      totalShares: null,
      totalInvested: 0,
      totalDividends: 0,
    };
    // Dividends aren't cost basis — kept out of "Investi"/gain, tallied separately. Fees aren't
    // cost basis either (already reflected in the account's manually-entered value) — ignored here.
    if (e.entryType === 'dividend') existing.totalDividends += e.amountInvested;
    else if (e.entryType === 'contribution') existing.totalInvested += e.amountInvested;
    if (e.assetType) existing.assetType = e.assetType;
    if (e.isin) existing.isin = e.isin;
    if (e.shares !== null) existing.totalShares = (existing.totalShares ?? 0) + e.shares;
    byTicker.set(e.ticker, existing);
  }
  return Array.from(byTicker.values());
}

// EUR-based rates (1 EUR = rates[currency] units of that currency) — same object
// useFormatCurrency reads for display conversion, reused here for storage conversion instead.
function toEurUnits(amount: number, currency: string, rates: Record<string, number> | undefined): number | null {
  if (currency === 'EUR') return amount;
  const rate = rates?.[currency];
  if (!rate) return null;
  return amount / rate;
}

/** Per-ticker positions aggregated client-side from the account's DCA entries (shares/ISIN/type
 * saved per entry, see AddEntryDrawer), joined with live Alpha Vantage quotes converted to EUR
 * (see quote.service.ts's SYMBOL_SEARCH currency resolution). Each card only shows the essentials
 * (amount + gain%) — no sparkline, since there's no stored daily price history per ticker to draw
 * one honestly, only today's quote. Hover a card for the rest (ISIN, shares, quote, last update).
 * The account's official "Valeur actuelle" stays whatever was last entered/computed — this section
 * only proposes an update, via the button below, rather than writing to it automatically. */
export function PositionsCard({ accountId, entries }: { accountId: string; entries: InvestmentEntry[] }) {
  const holdings = useMemo(() => buildHoldings(entries), [entries]);
  const tickers = useMemo(() => holdings.map((h) => h.ticker), [holdings]);
  const quoteResults = useStockQuotes(tickers);
  const { data: exchangeRates } = useExchangeRates();
  const updateAccount = useUpdateInvestmentAccount();
  const toast = useToast();
  const { formatCents } = useFormatCurrency();
  const [hovered, setHovered] = useState<PositionRow | null>(null);

  if (holdings.length === 0) return null;

  const rows: PositionRow[] = holdings.map((h, i) => {
    const quote = quoteResults[i]?.data;
    const priceEur = quote?.currency ? toEurUnits(quote.price, quote.currency, exchangeRates?.rates) : null;
    const marketValueEur = h.totalShares !== null && priceEur !== null ? h.totalShares * priceEur : null;
    const investedUnits = h.totalInvested / 100;
    const gainPct =
      marketValueEur !== null && investedUnits > 0 ? ((marketValueEur - investedUnits) / investedUnits) * 100 : null;
    return { ...h, quote, marketValueEur, gainPct };
  });

  const withMarketValue = rows.filter((r) => r.quote && r.marketValueEur !== null);
  const totalMarketValueEur = withMarketValue.reduce((sum, r) => sum + (r.marketValueEur ?? 0), 0);
  const weightedTrend =
    withMarketValue.length === 0
      ? null
      : totalMarketValueEur > 0
        ? withMarketValue.reduce((sum, r) => sum + r.quote!.changePercent * (r.marketValueEur ?? 0), 0) /
          totalMarketValueEur
        : withMarketValue.reduce((sum, r) => sum + r.quote!.changePercent, 0) / withMarketValue.length;

  // Every entry needs a ticker (not just the ones that already have one) — otherwise some of the
  // account's money lives outside the tracked positions and the computed total would silently
  // undercount it. Conservative on purpose: better to hide the button than write a wrong value.
  const allEntriesTracked = entries.length > 0 && entries.every((e) => e.ticker);
  const allPositionsConverted = rows.every((r) => r.marketValueEur !== null);
  const canUpdateValue = allEntriesTracked && allPositionsConverted;

  function handleUpdateValue() {
    updateAccount.mutate(
      { id: accountId, input: { currentValue: Math.round(totalMarketValueEur * 100) } },
      {
        onSuccess: () => toast.success('Valeur du compte mise à jour'),
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-text-primary">Positions</p>
          {weightedTrend !== null && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              Tendance du jour <Variation percent={weightedTrend} />
            </div>
          )}
        </div>
        {canUpdateValue && (
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={handleUpdateValue}
            disabled={updateAccount.isPending}
          >
            {updateAccount.isPending
              ? 'Mise à jour…'
              : `Mettre à jour la valeur du compte (${formatCents(Math.round(totalMarketValueEur * 100))})`}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {rows.map((r) => (
          <button
            key={r.ticker}
            type="button"
            onMouseEnter={() => setHovered(r)}
            onFocus={() => setHovered(r)}
            className="flex w-[160px] shrink-0 flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-4 text-left transition-colors hover:border-accent-gold/50"
          >
            <div className="flex items-start justify-between">
              <Avatar name={r.ticker} size={28} />
              {r.assetType && <Badge variant="accent">{r.assetType === 'etf' ? 'ETF' : 'Action'}</Badge>}
            </div>
            <p className="truncate text-sm font-medium text-text-primary">{r.ticker}</p>
            <div>
              <p className="font-mono text-sm font-semibold text-text-primary">
                {formatCents(r.marketValueEur !== null ? Math.round(r.marketValueEur * 100) : r.totalInvested)}
              </p>
              {r.gainPct !== null ? (
                <p className={`font-mono text-xs ${r.gainPct >= 0 ? 'text-accent-2' : 'text-accent-3'}`}>
                  {r.gainPct >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(r.gainPct))}
                </p>
              ) : (
                <p className="text-xs text-text-muted">Investi</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {!canUpdateValue && (
        <p className="mt-4 text-xs text-text-muted">
          Cours indicatifs (Alpha Vantage){' '}
          {!allEntriesTracked && "— au moins une entrée n'a pas de ticker, "}
          {allEntriesTracked && !allPositionsConverted && '— devise de cotation non résolue pour au moins une position, '}
          impossible de proposer une mise à jour fiable de la valeur du compte.
        </p>
      )}

      <PositionDetailModal position={hovered} onClose={() => setHovered(null)} />
    </Card>
  );
}
