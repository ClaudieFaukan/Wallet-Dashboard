import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { RealEstateAsset } from '../../../types/api';
import { useUpdateRealEstateAsset } from '../hooks/useRealEstate';

export function EditRealEstateDrawer({
  asset,
  open,
  onClose,
}: {
  asset: RealEstateAsset | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={asset ? `Éditer — ${asset.name}` : 'Éditer'}>
      {asset && <EditRealEstateForm key={asset.id} asset={asset} onClose={onClose} />}
    </Drawer>
  );
}

function EditRealEstateForm({ asset, onClose }: { asset: RealEstateAsset; onClose: () => void }) {
  const [name, setName] = useState(asset.name);
  const [monthlyIncome, setMonthlyIncome] = useState((asset.monthlyIncome / 100).toString());
  const [location, setLocation] = useState(asset.location ?? '');
  const [surfaceM2, setSurfaceM2] = useState(asset.surfaceM2?.toString() ?? '');
  const [platform, setPlatform] = useState(asset.platform ?? '');

  const update = useUpdateRealEstateAsset();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate(
      {
        id: asset.id,
        input: {
          name,
          monthlyIncome: Math.round(Number(monthlyIncome) * 100),
          ...(asset.type === 'physical'
            ? { location: location || undefined, surfaceM2: surfaceM2 ? Number(surfaceM2) : undefined }
            : {}),
          ...(asset.type === 'crowdfunding' ? { platform: platform || undefined } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success('Actif mis à jour');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input
        label="Revenu mensuel (€)"
        type="number"
        step="0.01"
        min="0"
        value={monthlyIncome}
        onChange={(e) => setMonthlyIncome(e.target.value)}
      />
      {asset.type === 'physical' && (
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
      {asset.type === 'crowdfunding' && (
        <Input label="Plateforme" value={platform} onChange={(e) => setPlatform(e.target.value)} />
      )}
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
