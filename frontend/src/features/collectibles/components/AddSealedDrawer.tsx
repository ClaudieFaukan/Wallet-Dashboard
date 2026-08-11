import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { getErrorMessage } from '../../../lib/api';
import type { CollectibleSealedLanguage, CollectibleSealedType } from '../../../types/api';

type SealedPriceSource = 'manual' | 'pokemonpricetracker' | 'poketrace';
import { useCollectiblesConfig, useCreateCollectible } from '../hooks/useCollectibles';

export function AddSealedDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [productSetName, setProductSetName] = useState('');
  const [sealedType, setSealedType] = useState<CollectibleSealedType>('etb');
  const [sealedLanguage, setSealedLanguage] = useState<CollectibleSealedLanguage>('FR');
  const [imageUrl, setImageUrl] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [priceSource, setPriceSource] = useState<SealedPriceSource>('manual');

  const { data: config } = useCollectiblesConfig();
  const autoAvailable = Boolean(config?.pokemonPriceTrackerConfigured || config?.poketraceConfigured);
  const create = useCreateCollectible();
  const toast = useToast();
  const { displayCurrency, fromDisplayCents } = useFormatCurrency();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        itemType: 'sealed',
        name,
        setName: productSetName || undefined,
        imageUrl: imageUrl || undefined,
        sealedType,
        sealedLanguage,
        purchasePrice: fromDisplayCents(Math.round(Number(purchasePrice) * 100)),
        purchaseDate: new Date(purchaseDate).toISOString(),
        priceSource: autoAvailable ? priceSource : 'manual',
      },
      {
        onSuccess: () => {
          toast.success('Produit scellé ajouté');
          setName('');
          setProductSetName('');
          setImageUrl('');
          setPurchasePrice('');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Ajouter un produit scellé">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nom du produit" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Set / extension" value={productSetName} onChange={(e) => setProductSetName(e.target.value)} />
        <Select label="Type" value={sealedType} onChange={(e) => setSealedType(e.target.value as CollectibleSealedType)}>
          <option value="etb">Elite Trainer Box</option>
          <option value="booster_box">Booster Box</option>
          <option value="blister">Blister</option>
          <option value="collection">Collection</option>
          <option value="display">Display</option>
        </Select>
        <Select label="Langue" value={sealedLanguage} onChange={(e) => setSealedLanguage(e.target.value as CollectibleSealedLanguage)}>
          <option value="FR">Français</option>
          <option value="EN">Anglais</option>
          <option value="JP">Japonais</option>
        </Select>
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
        {autoAvailable ? (
          <Select label="Source de prix" value={priceSource} onChange={(e) => setPriceSource(e.target.value as SealedPriceSource)}>
            <option value="manual">Manuel</option>
            {config?.pokemonPriceTrackerConfigured && <option value="pokemonpricetracker">Auto — PokemonPriceTracker</option>}
            {config?.poketraceConfigured && <option value="poketrace">Auto — Poketrace</option>}
          </Select>
        ) : (
          <p className="text-xs text-text-muted">
            Prix mis à jour manuellement — aucune source automatique configurée (voir Réglages).
          </p>
        )}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
      </form>
    </Drawer>
  );
}
