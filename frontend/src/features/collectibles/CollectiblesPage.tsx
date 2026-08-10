import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { CollectiblesSummary } from './components/CollectiblesSummary';
import { CardTile } from './components/CardTile';
import { SealedTile } from './components/SealedTile';
import { WatchTile } from './components/WatchTile';
import { AddCardDrawer } from './components/AddCardDrawer';
import { AddSealedDrawer } from './components/AddSealedDrawer';
import { AddWatchDrawer } from './components/AddWatchDrawer';
import { UpdatePriceDrawer } from './components/UpdatePriceDrawer';
import { EditCollectibleDrawer } from './components/EditCollectibleDrawer';
import { useCollectibleItems, useCollectiblePerformance } from './hooks/useCollectibles';
import type { CollectibleItem, CollectibleItemType } from '../../types/api';

const addLabels: Record<CollectibleItemType, string> = {
  card: 'Ajouter une carte',
  sealed: 'Ajouter un scellé',
  watch: 'Ajouter une montre',
};

export function CollectiblesPage() {
  const [tab, setTab] = useState<CollectibleItemType>('card');
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
            {addLabels[tab]}
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
            { value: 'watch', label: 'Montres' },
          ]}
        />

        <div className="grid grid-cols-3 gap-4">
          {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}
          {items?.length === 0 && <p className="col-span-3 text-sm text-text-muted">Aucun item.</p>}
          {tab === 'card' &&
            items?.map((item) => (
              <CardTile key={item.id} item={item} performance={performanceById.get(item.id)} onEdit={setEditItem} />
            ))}
          {tab === 'sealed' &&
            items?.map((item) => (
              <SealedTile
                key={item.id}
                item={item}
                performance={performanceById.get(item.id)}
                onEditPrice={setPriceItem}
                onEdit={setEditItem}
              />
            ))}
          {tab === 'watch' &&
            items?.map((item) => (
              <WatchTile
                key={item.id}
                item={item}
                performance={performanceById.get(item.id)}
                onEditPrice={setPriceItem}
                onEdit={setEditItem}
              />
            ))}
        </div>
      </div>

      {tab === 'card' && <AddCardDrawer open={addDrawerOpen} onClose={() => setAddDrawerOpen(false)} />}
      {tab === 'sealed' && <AddSealedDrawer open={addDrawerOpen} onClose={() => setAddDrawerOpen(false)} />}
      {tab === 'watch' && <AddWatchDrawer open={addDrawerOpen} onClose={() => setAddDrawerOpen(false)} />}
      <UpdatePriceDrawer item={priceItem} open={priceItem !== null} onClose={() => setPriceItem(null)} />
      <EditCollectibleDrawer item={editItem} open={editItem !== null} onClose={() => setEditItem(null)} />
    </div>
  );
}
