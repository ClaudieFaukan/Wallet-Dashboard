import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { AccountCard } from './components/AccountCard';
import { CreateAccountDrawer } from './components/CreateAccountDrawer';
import { useAccounts } from './hooks/useAccounts';

export function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div>
      <Header
        title="Comptes"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Nouveau compte
          </Button>
        }
      />
      <div className="grid grid-cols-3 gap-4 p-8">
        {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        {accounts?.length === 0 && (
          <p className="col-span-3 text-sm text-text-muted">Aucun compte pour l'instant.</p>
        )}
        {accounts?.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>
      <CreateAccountDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
