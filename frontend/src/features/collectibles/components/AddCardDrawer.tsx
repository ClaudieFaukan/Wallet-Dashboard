import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { getErrorMessage } from '../../../lib/api';
import type { CardSearchResult, CollectibleCondition } from '../../../types/api';
import { useCreateCollectible, useSearchCard } from '../hooks/useCollectibles';

export function AddCardDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CardSearchResult | null>(null);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState<CollectibleCondition>('NM');
  const [notes, setNotes] = useState('');

  const debouncedQuery = useDebouncedValue(query, 300);
  const search = useSearchCard(debouncedQuery);
  const create = useCreateCollectible();
  const toast = useToast();

  function reset() {
    setQuery('');
    setSelected(null);
    setPurchasePrice('');
    setNotes('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    create.mutate(
      {
        itemType: 'card',
        name: selected.name,
        setName: selected.setName ?? undefined,
        imageUrl: selected.imageUrl ?? undefined,
        cardNumber: selected.cardNumber ?? undefined,
        tcgdexId: selected.tcgdexId,
        purchasePrice: Math.round(Number(purchasePrice) * 100),
        purchaseDate: new Date(purchaseDate).toISOString(),
        condition,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Carte ajoutée');
          reset();
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Ajouter une carte">
      {!selected ? (
        <div className="flex flex-col gap-3">
          <Input
            label="Rechercher une carte"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pikachu…"
            autoFocus
          />
          {query.length > 0 && query.length <= 1 && (
            <p className="text-xs text-text-muted">Encore un caractère…</p>
          )}
          {search.isFetching && <p className="text-xs text-text-muted">Recherche…</p>}
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {!search.isFetching &&
              search.data?.map((result) => (
                <li key={result.tcgdexId}>
                  <button
                    type="button"
                    onClick={() => setSelected(result)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-left text-sm hover:border-accent-gold"
                  >
                    {result.imageUrl && (
                      <img src={result.imageUrl} alt="" className="h-10 w-10 rounded object-contain" />
                    )}
                    <div>
                      <p className="text-text-primary">{result.name}</p>
                      <p className="text-xs text-text-muted">{result.setName ?? 'Set inconnu'}</p>
                    </div>
                  </button>
                </li>
              ))}
            {!search.isFetching && debouncedQuery.length > 1 && search.data?.length === 0 && (
              <li className="text-sm text-text-muted">Aucun résultat</li>
            )}
          </ul>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-elevated px-3 py-2">
            {selected.imageUrl && (
              <img src={selected.imageUrl} alt="" className="h-12 w-12 rounded object-contain" />
            )}
            <div className="flex-1">
              <p className="text-sm text-text-primary">{selected.name}</p>
              <p className="text-xs text-text-muted">{selected.setName ?? 'Set à compléter manuellement'}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-accent">
              Changer
            </button>
          </div>

          <Input
            label="Prix d'achat (€)"
            type="number"
            step="0.01"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            required
          />
          <Input
            label="Date d'achat"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            required
          />
          <Select label="Condition" value={condition} onChange={(e) => setCondition(e.target.value as CollectibleCondition)}>
            <option value="NM">Near Mint (NM)</option>
            <option value="LP">Lightly Played (LP)</option>
            <option value="MP">Moderately Played (MP)</option>
            <option value="HP">Heavily Played (HP)</option>
            <option value="DMG">Damaged (DMG)</option>
          </Select>
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Ajout…' : 'Ajouter la carte'}
          </Button>
        </form>
      )}
    </Drawer>
  );
}
