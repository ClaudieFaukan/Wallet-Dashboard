import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProgressBar } from '../../components/charts/ProgressBar';
import { formatCents } from '../../lib/format';
import { CreateInvestmentAccountDrawer } from './components/CreateInvestmentAccountDrawer';
import { useInvestmentAccounts, useInvestmentMilestones } from './hooks/useInvestments';

export function InvestmentsPage() {
  const { data: accounts, isLoading } = useInvestmentAccounts();
  const { data: milestones } = useInvestmentMilestones();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div>
      <Header
        title="Investissements"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Nouveau compte
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        {milestones && (
          <Card>
            <p className="mb-3 text-xs uppercase tracking-wide text-text-muted">
              Total investi {formatCents(milestones.currentTotal)}
            </p>
            <div className="space-y-3">
              {milestones.next.map((m) => (
                <ProgressBar key={m.amount} value={m.progress * 100} label={`Jalon ${formatCents(m.amount)}`} />
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-4">
          {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          {accounts?.map((account) => (
            <Link key={account.id} to={`/investments/${account.id}`}>
              <Card className="transition-colors hover:border-accent/50">
                <p className="text-sm font-semibold text-text-primary">{account.name}</p>
                {account.platform && <p className="text-xs text-text-muted">{account.platform}</p>}
                <p className="mt-2 font-mono text-lg font-semibold text-text-primary">
                  {formatCents(account.currentValue, account.currency)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
      <CreateInvestmentAccountDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
