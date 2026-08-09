import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { CollectiblesSummary } from './components/CollectiblesSummary';
import { CardTile } from './components/CardTile';
import { SealedTile } from './components/SealedTile';
import { AddCardDrawer } from './components/AddCardDrawer';
import { AddSealedDrawer } from './components/AddSealedDrawer';
import { UpdatePriceDrawer } from './components/UpdatePriceDrawer';
import { EditCollectibleDrawer } from './components/EditCollectibleDrawer';
import { useCollectibleItems, useCollectiblePerformance } from './hooks/useCollectibles';
import type { CollectibleItem } from '../../types/api';

export function CollectiblesPage() {
  const [tab, setTab] = useState<'card' | 'sealed'>('card');
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [priceItem, setPriceItem] = useState<CollectibleItem | null>(null);
  const [editItem, setEditItem] = useState<CollectibleItem | null>(null);

  const { data: items, isLoading } = useCollectibleItems(tab);
  const { data: performance } = useCollectiblePerformance(undefined, tab);
  const performanceById = new Map((performance?.items ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <Header
        title="Collectibles"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setAddDrawerOpen(true)}>
            {tab === 'card' ? 'Ajouter une carte' : 'Ajouter un scellé'}
          </Button>
        }
      />
      <div className="space-y-6 p-8">
        <CollectiblesSummary />

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'card', label: 'Cartes singles' },
            { value: 'sealed', label: 'Produits scellés' },
          ]}
        />

        <div className="grid grid-cols-3 gap-4">
          {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}
          {items?.length === 0 && <p className="col-span-3 text-sm text-text-muted">Aucun item.</p>}
          {tab === 'card'
            ? items?.map((item) => (
                <CardTile key={item.id} item={item} performance={performanceById.get(item.id)} onEdit={setEditItem} />
              ))
            : items?.map((item) => (
                <SealedTile
                  key={item.id}
                  item={item}
                  performance={performanceById.get(item.id)}
                  onEditPrice={setPriceItem}
                  onEdit={setEditItem}
                />
              ))}
        </div>
      </div>

      {tab === 'card' ? (
        <AddCardDrawer open={addDrawerOpen} onClose={() => setAddDrawerOpen(false)} />
      ) : (
        <AddSealedDrawer open={addDrawerOpen} onClose={() => setAddDrawerOpen(false)} />
      )}
      <UpdatePriceDrawer item={priceItem} open={priceItem !== null} onClose={() => setPriceItem(null)} />
      <EditCollectibleDrawer item={editItem} open={editItem !== null} onClose={() => setEditItem(null)} />
    </div>
  );
}
