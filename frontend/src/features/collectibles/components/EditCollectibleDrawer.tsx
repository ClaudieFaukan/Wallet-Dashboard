import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Toggle } from '../../../components/ui/Toggle';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type {
  CollectibleCardLanguage,
  CollectibleCondition,
  CollectibleGradingCompany,
  CollectibleItem,
  CollectibleSealedLanguage,
  CollectibleSealedType,
} from '../../../types/api';
import { useDeleteCollectible, useUpdateCollectible } from '../hooks/useCollectibles';

const sealedTypeLabels: Record<CollectibleSealedType, string> = {
  booster_box: 'Booster Box',
  etb: 'Elite Trainer Box',
  blister: 'Blister',
  collection: 'Collection',
  display: 'Display',
};

const cardLanguageLabels: Record<CollectibleCardLanguage, string> = {
  FR: 'Français',
  EN: 'Anglais',
  JP: 'Japonais',
};

const gradingCompanyLabels: Record<CollectibleGradingCompany, string> = {
  PSA: 'PSA',
  BGS: 'BGS',
  CGC: 'CGC',
  SGC: 'SGC',
  other: 'Autre',
};

export function EditCollectibleDrawer({
  item,
  open,
  onClose,
}: {
  item: CollectibleItem | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={item ? `Éditer — ${item.name}` : 'Éditer'}>
      {item && <EditCollectibleForm key={item.id} item={item} onClose={onClose} />}
    </Drawer>
  );
}

function EditCollectibleForm({ item, onClose }: { item: CollectibleItem; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? '');
  const [setName_, setSetName] = useState(item.setName ?? '');
  const [cardNumber, setCardNumber] = useState(item.cardNumber ?? '');
  const [condition, setCondition] = useState<CollectibleCondition>(item.condition ?? 'NM');
  const [language, setLanguage] = useState<CollectibleCardLanguage | ''>(item.language ?? '');
  const [graded, setGraded] = useState(item.gradingCompany !== null);
  const [gradingCompany, setGradingCompany] = useState<CollectibleGradingCompany>(
    item.gradingCompany ?? 'PSA',
  );
  const [gradingScore, setGradingScore] = useState((item.gradingScore ?? 10).toString());
  const [sealedType, setSealedType] = useState<CollectibleSealedType>(item.sealedType ?? 'booster_box');
  const [sealedLanguage, setSealedLanguage] = useState<CollectibleSealedLanguage>(item.sealedLanguage ?? 'FR');
  const [brand, setBrand] = useState(item.brand ?? '');
  const [model, setModel] = useState(item.model ?? '');
  const [reference, setReference] = useState(item.reference ?? '');
  const [year, setYear] = useState(item.year?.toString() ?? '');
  const [watchCondition, setWatchCondition] = useState(item.watchCondition ?? '');
  const [purchasePrice, setPurchasePrice] = useState((item.purchasePrice / 100).toString());
  const [purchaseDate, setPurchaseDate] = useState(item.purchaseDate.slice(0, 10));
  const [notes, setNotes] = useState(item.notes ?? '');

  const update = useUpdateCollectible();
  const del = useDeleteCollectible();
  const toast = useToast();

  function handleDelete() {
    del.mutate(item.id, {
      onSuccess: () => {
        toast.success('Item supprimé');
        onClose();
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    update.mutate(
      {
        id: item.id,
        input: {
          name,
          imageUrl: imageUrl || undefined,
          setName: item.itemType === 'card' ? setName_ || undefined : undefined,
          cardNumber: item.itemType === 'card' ? cardNumber || undefined : undefined,
          condition: item.itemType === 'card' && !graded ? condition : undefined,
          language: item.itemType === 'card' ? language || undefined : undefined,
          gradingCompany: item.itemType === 'card' && graded ? gradingCompany : undefined,
          gradingScore: item.itemType === 'card' && graded ? Number(gradingScore) : undefined,
          sealedType: item.itemType === 'sealed' ? sealedType : undefined,
          sealedLanguage: item.itemType === 'sealed' ? sealedLanguage : undefined,
          brand: item.itemType === 'watch' ? brand || undefined : undefined,
          model: item.itemType === 'watch' ? model || undefined : undefined,
          reference: item.itemType === 'watch' ? reference || undefined : undefined,
          year: item.itemType === 'watch' && year ? Number(year) : undefined,
          watchCondition: item.itemType === 'watch' ? watchCondition || undefined : undefined,
          purchasePrice: Math.round(Number(purchasePrice) * 100),
          purchaseDate: new Date(purchaseDate).toISOString(),
          notes: notes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Item mis à jour');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="URL de l'image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />

        {item.itemType === 'card' && (
          <>
            <Input label="Set" value={setName_} onChange={(e) => setSetName(e.target.value)} />
            <Input label="Numéro de carte" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
            <Select
              label="Langue"
              value={language}
              onChange={(e) => setLanguage(e.target.value as CollectibleCardLanguage | '')}
            >
              <option value="">Non précisée</option>
              {Object.entries(cardLanguageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>

            <Toggle checked={graded} onChange={setGraded} label="Carte gradée" />

            {graded ? (
              <div className="flex gap-3">
                <Select
                  label="Grading"
                  value={gradingCompany}
                  onChange={(e) => setGradingCompany(e.target.value as CollectibleGradingCompany)}
                  className="flex-1"
                >
                  {Object.entries(gradingCompanyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Note"
                  type="number"
                  min="1"
                  max="10"
                  step="0.5"
                  value={gradingScore}
                  onChange={(e) => setGradingScore(e.target.value)}
                  className="w-24"
                  required
                />
              </div>
            ) : (
              <Select
                label="Condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as CollectibleCondition)}
              >
                <option value="NM">Near Mint (NM)</option>
                <option value="LP">Lightly Played (LP)</option>
                <option value="MP">Moderately Played (MP)</option>
                <option value="HP">Heavily Played (HP)</option>
                <option value="DMG">Damaged (DMG)</option>
              </Select>
            )}
          </>
        )}
        {item.itemType === 'sealed' && (
          <>
            <Select
              label="Type"
              value={sealedType}
              onChange={(e) => setSealedType(e.target.value as CollectibleSealedType)}
            >
              {Object.entries(sealedTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              label="Langue"
              value={sealedLanguage}
              onChange={(e) => setSealedLanguage(e.target.value as CollectibleSealedLanguage)}
            >
              <option value="FR">Français</option>
              <option value="EN">Anglais</option>
              <option value="JP">Japonais</option>
            </Select>
          </>
        )}
        {item.itemType === 'watch' && (
          <>
            <Input label="Marque" value={brand} onChange={(e) => setBrand(e.target.value)} />
            <Input label="Modèle" value={model} onChange={(e) => setModel(e.target.value)} />
            <Input label="Référence" value={reference} onChange={(e) => setReference(e.target.value)} />
            <Input label="Année" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            <Input label="État" value={watchCondition} onChange={(e) => setWatchCondition(e.target.value)} />
          </>
        )}

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
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="danger" disabled={del.isPending} onClick={handleDelete}>
          {del.isPending ? 'Suppression…' : 'Supprimer'}
        </Button>
    </form>
  );
}
