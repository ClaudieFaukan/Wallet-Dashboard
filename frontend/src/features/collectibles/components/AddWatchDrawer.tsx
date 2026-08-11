import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { getErrorMessage } from '../../../lib/api';
import { useCreateCollectible } from '../hooks/useCollectibles';

export function AddWatchDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [reference, setReference] = useState('');
  const [year, setYear] = useState('');
  const [watchCondition, setWatchCondition] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const create = useCreateCollectible();
  const toast = useToast();
  const { displayCurrency, fromDisplayCents } = useFormatCurrency();

  function reset() {
    setName('');
    setBrand('');
    setModel('');
    setReference('');
    setYear('');
    setWatchCondition('');
    setImageUrl('');
    setPurchasePrice('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        itemType: 'watch',
        name,
        brand: brand || undefined,
        model: model || undefined,
        reference: reference || undefined,
        year: year ? Number(year) : undefined,
        watchCondition: watchCondition || undefined,
        imageUrl: imageUrl || undefined,
        purchasePrice: fromDisplayCents(Math.round(Number(purchasePrice) * 100)),
        purchaseDate: new Date(purchaseDate).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success('Montre ajoutée');
          reset();
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Ajouter une montre">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Marque" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Rolex, Omega…" />
        <Input label="Modèle" value={model} onChange={(e) => setModel(e.target.value)} />
        <Input label="Référence" value={reference} onChange={(e) => setReference(e.target.value)} />
        <Input label="Année" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        <Input
          label="État"
          value={watchCondition}
          onChange={(e) => setWatchCondition(e.target.value)}
          placeholder="Neuf, occasion excellent état…"
        />
        <Input label="URL de l'image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        <Input
          label={`Prix d'achat (${displayCurrency})`}
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
        <p className="text-xs text-text-muted">
          Prix mis à jour manuellement — aucune API fiable n'existe pour les montres.
        </p>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
      </form>
    </Drawer>
  );
}
