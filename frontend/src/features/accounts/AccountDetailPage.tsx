import { useParams } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { LineChartCard } from '../../components/charts/LineChartCard';
import { formatDate } from '../../lib/format';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { TransactionsTable } from '../transactions/components/TransactionsTable';
import { useCategories, useTransactions } from '../transactions/hooks/useTransactions';
import { useAccount, useAccountBalanceHistory } from './hooks/useAccounts';

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = id ?? '';
  const { data: account } = useAccount(accountId);
  const { data: history } = useAccountBalanceHistory(accountId, 90);
  const { data: categories } = useCategories();
  const { data: transactions } = useTransactions({ accountId, limit: 50 });
  const { formatCents } = useFormatCurrency();

  return (
    <div>
      <Header title={account?.name ?? 'Compte'} />
      <div className="space-y-6 p-8">
        {account && (
          <Card>
            <p className="text-sm text-text-secondary">Solde actuel</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[-0.03em] text-text-primary">
              {formatCents(account.balance, account.currency)}
            </p>
          </Card>
        )}

        {history && history.length > 1 && (
          <LineChartCard
            title="Solde — 90 derniers jours"
            data={history.map((p) => ({ date: formatDate(p.date, { day: '2-digit', month: 'short' }), value: p.balance }))}
            xKey="date"
            series={[{ key: 'value', label: 'Solde' }]}
            formatValue={(v) => formatCents(v)}
          />
        )}

        <Card>
          <h3 className="mb-3 text-sm font-medium text-text-muted">Transactions</h3>
          <TransactionsTable transactions={transactions?.data ?? []} categories={categories ?? []} />
        </Card>
      </div>
    </div>
  );
}
