import { useParams } from 'react-router-dom';
import { Link2, Trash2 } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/charts/ProgressBar';
import { useToast } from '../../components/ui/Toast';
import { getErrorMessage } from '../../lib/api';
import { formatDate, formatPercent } from '../../lib/format';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import {
  useCredit,
  useCreditPayments,
  useLinkPayment,
  useSuggestedPayments,
  useUnlinkPayment,
} from './hooks/useCredits';

export function CreditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const creditId = id ?? '';
  const { data: credit } = useCredit(creditId);
  const { data: payments } = useCreditPayments(creditId);
  const { data: suggestions } = useSuggestedPayments(creditId);
  const linkPayment = useLinkPayment(creditId);
  const unlinkPayment = useUnlinkPayment(creditId);
  const toast = useToast();
  const { formatCents } = useFormatCurrency();

  function handleLink(transactionId: string) {
    linkPayment.mutate(transactionId, {
      onSuccess: () => toast.success('Paiement lié'),
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  }

  function handleUnlink(paymentId: string) {
    unlinkPayment.mutate(paymentId, { onError: (err) => toast.error(getErrorMessage(err)) });
  }

  const repaidAmount = credit ? credit.initialAmount - credit.remainingAmount : 0;
  const repaidPct = credit && credit.initialAmount > 0 ? (repaidAmount / credit.initialAmount) * 100 : 0;

  return (
    <div>
      <Header title={credit?.name ?? 'Crédit'} backTo="/credits" />
      <div className="space-y-6 p-8">
        {credit && (
          <Card>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-text-muted">Mensualité</p>
                <p className="font-mono text-text-primary">{formatCents(credit.monthlyPayment)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Capital restant</p>
                <p className="font-mono text-accent-3">{formatCents(credit.remainingAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Taux</p>
                <p className="font-mono text-text-primary">{formatPercent(credit.interestRate * 100)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Fin</p>
                <p className="font-mono text-text-primary">{formatDate(credit.endDate)}</p>
              </div>
            </div>
            <div className="mt-4">
              <ProgressBar
                value={repaidPct}
                label={`Remboursé ${formatCents(repaidAmount)} / ${formatCents(credit.initialAmount)}`}
              />
            </div>
          </Card>
        )}

        <Card>
          <h3 className="mb-1 text-sm font-medium text-text-muted">Paiements suggérés</h3>
          <p className="mb-4 text-xs text-text-muted">
            Transactions de tes comptes qui ressemblent à un remboursement de ce crédit (montant ou
            établissement correspondant), pas encore liées.
          </p>

          {suggestions && suggestions.length === 0 && (
            <p className="text-sm text-text-muted">Aucune transaction correspondante détectée.</p>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="divide-y divide-border/50">
              {suggestions.map((s) => (
                <div key={s.transactionId} className="flex items-center gap-4 py-3 text-sm">
                  <span className="w-24 shrink-0 text-text-muted">{formatDate(s.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-text-primary">
                    {s.description ?? 'Transaction'}
                  </span>
                  <span className="w-28 shrink-0 text-right font-mono text-text-primary">
                    {formatCents(s.amount)}
                  </span>
                  <span className="w-40 shrink-0 text-right text-xs text-text-muted">
                    dont {formatCents(s.principalPart)} capital
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Link2 size={14} />}
                    disabled={linkPayment.isPending}
                    onClick={() => handleLink(s.transactionId)}
                  >
                    Lier
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-medium text-text-muted">Historique des paiements</h3>

          {payments && payments.length === 0 && (
            <p className="text-sm text-text-muted">Aucun paiement enregistré pour l'instant.</p>
          )}

          {payments && payments.length > 0 && (
            <div className="divide-y divide-border/50">
              {payments.map((p) => (
                <div key={p.id} className="group flex items-center gap-4 py-3 text-sm">
                  <span className="w-24 shrink-0 text-text-muted">{formatDate(p.date)}</span>
                  <span className="w-24 shrink-0">
                    <Badge variant={p.transactionId ? 'success' : 'neutral'}>
                      {p.transactionId ? 'Lié' : 'Manuel'}
                    </Badge>
                  </span>
                  <span className="flex-1" />
                  <span className="w-28 shrink-0 text-right font-mono text-text-primary">
                    {formatCents(p.amount)}
                  </span>
                  <span className="w-56 shrink-0 text-right text-xs text-text-muted">
                    {formatCents(p.principalPart)} capital · {formatCents(p.interestPart)} intérêts
                  </span>
                  <button
                    type="button"
                    title="Annuler ce paiement"
                    onClick={() => handleUnlink(p.id)}
                    className="shrink-0 rounded-md p-1.5 text-text-muted opacity-0 transition-opacity hover:bg-bg-elevated hover:text-accent-3 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
