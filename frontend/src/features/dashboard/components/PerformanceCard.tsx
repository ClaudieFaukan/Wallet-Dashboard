import { Card } from '../../../components/ui/Card';
import { Variation } from '../../../components/ui/Variation';

interface PerformanceCardProps {
  amountCents: number | null;
  percent: number | null;
  periodLabel: string;
}

export function PerformanceCard({ amountCents, percent, periodLabel }: PerformanceCardProps) {
  return (
    <Card className="flex flex-col">
      <h3 className="text-sm font-medium text-text-muted">Performance</h3>

      {amountCents === null ? (
        <p className="mt-4 text-sm text-text-muted">Pas encore assez d’historique pour cette période.</p>
      ) : (
        <>
          <p className="mt-4 text-xs text-text-secondary">Plus-value — {periodLabel}</p>
          <div className="mt-1">
            <Variation amountCents={amountCents} percent={percent} className="text-base" />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-text-muted">
            La plus-value latente est la variation de votre patrimoine sur la période sélectionnée. Ce
            montant ne tient pas compte des plus-values réalisées.
          </p>
        </>
      )}
    </Card>
  );
}
