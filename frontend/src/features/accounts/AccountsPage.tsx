import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { DonutChartCard } from '../../components/charts/DonutChartCard';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { AccountRow } from './components/AccountRow';
import { CreateAccountDrawer } from './components/CreateAccountDrawer';
import { useAccounts } from './hooks/useAccounts';

export function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { formatCents } = useFormatCurrency();

  const total = (accounts ?? []).reduce((sum, a) => sum + a.balance, 0);
  const donutData = (accounts ?? []).map((a) => ({ label: a.name, value: a.balance }));

  return (
    <div>
      <Header
        title="Patrimoine"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Nouveau compte
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        {isLoading && (
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="col-span-2 h-64" />
            <Skeleton className="h-64" />
          </div>
        )}

        {!isLoading && accounts && accounts.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="col-span-2 flex flex-col justify-center">
              <p className="text-sm text-text-secondary">Patrimoine total</p>
              <p className="mt-2 font-mono text-hero font-bold tracking-[-0.03em] text-text-primary">
                {formatCents(total)}
              </p>
            </Card>
            <DonutChartCard title="Répartition par compte" data={donutData} formatValue={(v) => formatCents(v)} />
          </div>
        )}

        {!isLoading && accounts?.length === 0 && (
          <p className="text-sm text-text-muted">Aucun compte pour l'instant.</p>
        )}

        {!isLoading && accounts && accounts.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-4 border-b border-border px-2 pb-3 text-xs font-medium text-text-muted">
              <div className="flex-1">Nom</div>
              <div className="w-44 shrink-0">Type</div>
              <div className="w-24 shrink-0">Répartition</div>
              <div className="w-28 shrink-0 text-right">Valeur</div>
              <div className="w-[92px] shrink-0" />
            </div>
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                sharePercent={total > 0 ? (account.balance / total) * 100 : 0}
              />
            ))}
          </Card>
        )}
      </div>
      <CreateAccountDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
