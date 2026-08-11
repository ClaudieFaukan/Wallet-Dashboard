import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { Variation } from '../../components/ui/Variation';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { usePatrimoineRows } from '../../hooks/usePatrimoineRows';
import { CreateWalletDrawer } from './components/CreateWalletDrawer';
import { TopCryptosCarousel } from './components/TopCryptosCarousel';
import { WalletCard } from './components/WalletCard';
import { useCryptoWallets } from './hooks/useCrypto';

export function CryptoPage() {
  const { data: wallets, isLoading } = useCryptoWallets();
  const patrimoine = usePatrimoineRows();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { formatCents } = useFormatCurrency();

  const cryptoRows = patrimoine.rows.filter((r) => r.kind === 'crypto');
  const rowsById = new Map(cryptoRows.map((r) => [r.id, r]));
  const totalValue = cryptoRows.reduce((sum, r) => sum + r.value, 0);
  const rowsWithYtd = cryptoRows.filter((r) => r.ytdVariation !== null);
  const totalYtdVariation =
    rowsWithYtd.length > 0 ? rowsWithYtd.reduce((sum, r) => sum + r.ytdVariation!, 0) : null;

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
      <div className="space-y-6 p-8">
        {!patrimoine.isLoading && cryptoRows.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <p className="text-sm text-text-secondary">Valeur totale</p>
              <p className="mt-1 font-mono text-hero font-bold tracking-[-0.03em] text-text-primary">
                {formatCents(totalValue)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Wallets</p>
              <p className="mt-1 font-mono text-lg font-semibold text-text-primary">{cryptoRows.length}</p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Variation année à date</p>
              <div className="mt-1">
                {totalYtdVariation !== null ? (
                  <Variation amountCents={totalYtdVariation} className="text-base" />
                ) : (
                  <span className="font-mono text-lg font-semibold text-text-primary">—</span>
                )}
              </div>
            </Card>
          </div>
        )}

        {wallets && wallets.length > 0 && <TopCryptosCarousel wallets={wallets} />}

        <div className="grid grid-cols-3 gap-4">
          {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
          {wallets?.length === 0 && <p className="text-sm text-text-muted">Aucun wallet pour l'instant.</p>}
          {wallets?.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} ytdVariationPct={rowsById.get(wallet.id)?.ytdVariationPct ?? null} />
          ))}
        </div>
      </div>
      <CreateWalletDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
