import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { RealEstateType } from '../../../types/api';
import { useCreateRealEstateAsset } from '../hooks/useRealEstate';

export function CreateRealEstateDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<RealEstateType>('physical');
  const [platform, setPlatform] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthlyIncome, setMonthlyIncome] = useState('0');
  const [surfaceM2, setSurfaceM2] = useState('');
  const [location, setLocation] = useState('');
  const create = useCreateRealEstateAsset();
  const toast = useToast();

  function reset() {
    setName('');
    setType('physical');
    setPlatform('');
    setPurchasePrice('');
    setCurrentValue('');
    setMonthlyIncome('0');
    setSurfaceM2('');
    setLocation('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        name,
        type,
        platform: type === 'crowdfunding' ? platform || undefined : undefined,
        purchasePrice: Math.round(Number(purchasePrice) * 100),
        currentValue: Math.round(Number(currentValue) * 100),
        purchaseDate: new Date(purchaseDate).toISOString(),
        monthlyIncome: Math.round(Number(monthlyIncome) * 100),
        surfaceM2: type === 'physical' && surfaceM2 ? Number(surfaceM2) : undefined,
        location: type === 'physical' ? location || undefined : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Actif ajouté');
          reset();
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nouvel actif immobilier">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as RealEstateType)}>
          <option value="physical">Physique</option>
          <option value="scpi">SCPI</option>
          <option value="crowdfunding">Crowdfunding immobilier</option>
        </Select>
        {type === 'crowdfunding' && (
          <Input
            label="Plateforme"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            placeholder="Brick, La Première Brique…"
          />
        )}
        {type === 'physical' && (
          <>
            <Input label="Localisation" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Input
              label="Surface (m²)"
              type="number"
              step="0.1"
              min="0"
              value={surfaceM2}
              onChange={(e) => setSurfaceM2(e.target.value)}
            />
          </>
        )}
        <Input
          label="Prix d'achat (€)"
          type="number"
          step="0.01"
          min="0"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          required
        />
        <Input
          label="Valeur actuelle (€)"
          type="number"
          step="0.01"
          min="0"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          required
        />
        <Input
          label="Revenu mensuel (loyer / dividende, €)"
          type="number"
          step="0.01"
          min="0"
          value={monthlyIncome}
          onChange={(e) => setMonthlyIncome(e.target.value)}
        />
        <Input label="Date d'achat" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
      </form>
    </Drawer>
  );
}
