import { Badge } from '../../../components/ui/Badge';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Modal } from '../../../components/ui/Modal';
import { Variation } from '../../../components/ui/Variation';
import { formatDate } from '../../../lib/format';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import type { PositionRow } from './PositionsCard';

/** Everything the compact position card doesn't have room for — opened on hover
 * (see PositionsCard), closed via the usual Modal chrome (X / backdrop click). */
export function PositionDetailModal({ position, onClose }: { position: PositionRow | null; onClose: () => void }) {
  const { formatCents } = useFormatCurrency();

  return (
    <Modal open={position !== null} onClose={onClose} title={position?.ticker ?? ''} size="lg">
      {position && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {position.assetType && (
              <Badge variant="accent">{position.assetType === 'etf' ? 'ETF' : 'Action'}</Badge>
            )}
            {position.isin && (
              <span className="flex items-center gap-1 text-xs text-text-muted">
                {position.isin}
                <CopyButton value={position.isin} />
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {position.totalShares !== null && (
              <div>
                <p className="text-xs text-text-muted">Parts détenues</p>
                <p className="font-mono text-text-primary">{position.totalShares}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-text-muted">Investi</p>
              <p className="font-mono text-text-primary">{formatCents(position.totalInvested)}</p>
            </div>
            {position.totalDividends > 0 && (
              <div>
                <p className="text-xs text-text-muted">Dividendes reçus</p>
                <p className="font-mono text-accent-2">{formatCents(position.totalDividends)}</p>
              </div>
            )}
            {position.marketValueEur !== null && (
              <div>
                <p className="text-xs text-text-muted">Valeur estimée</p>
                <p className="font-mono text-text-primary">
                  {formatCents(Math.round(position.marketValueEur * 100))}
                </p>
                {position.gainPct !== null && (
                  <div className="mt-0.5">
                    <Variation percent={position.gainPct} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            {position.quote ? (
              <>
                <p className="text-xs text-text-muted">Cours du jour</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-text-primary">
                    {position.quote.price} {position.quote.currency ?? '?'}
                  </span>
                  <Variation percent={position.quote.changePercent} />
                </div>
                <p className="mt-1 text-xs text-text-muted">Mis à jour {formatDate(position.quote.fetchedAt)}</p>
                {!position.quote.currency && (
                  <p className="mt-2 text-xs text-text-muted">
                    Devise de cotation non résolue — valeur estimée non calculable.
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-text-muted">
                Aucun cours disponible pour ce ticker (Alpha Vantage).
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
