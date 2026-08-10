import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { CreditCard } from './components/CreditCard';
import { CreateCreditDrawer } from './components/CreateCreditDrawer';
import { useCredits } from './hooks/useCredits';

export function CreditsPage() {
  const { data: credits, isLoading } = useCredits();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div>
      <Header
        title="Crédits"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Nouveau crédit
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 p-8">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
        {credits?.length === 0 && (
          <p className="col-span-2 text-sm text-text-muted">Aucun crédit pour l'instant.</p>
        )}
        {credits?.map((credit) => (
          <CreditCard key={credit.id} credit={credit} />
        ))}
      </div>
      <CreateCreditDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
