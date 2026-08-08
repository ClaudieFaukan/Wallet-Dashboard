import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { CreateWalletDrawer } from './components/CreateWalletDrawer';
import { WalletCard } from './components/WalletCard';
import { useCryptoWallets } from './hooks/useCrypto';

export function CryptoPage() {
  const { data: wallets, isLoading } = useCryptoWallets();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div>
      <Header
        title="Crypto"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Nouveau wallet
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 p-8">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
        {wallets?.length === 0 && <p className="text-sm text-text-muted">Aucun wallet pour l'instant.</p>}
        {wallets?.map((wallet) => (
          <WalletCard key={wallet.id} wallet={wallet} />
        ))}
      </div>
      <CreateWalletDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
