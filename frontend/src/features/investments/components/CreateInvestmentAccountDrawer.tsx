import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { getErrorMessage } from '../../../lib/api';
import { useCreateInvestmentAccount } from '../hooks/useInvestments';

export function CreateInvestmentAccountDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [currentValue, setCurrentValue] = useState('0');
  const create = useCreateInvestmentAccount();
  const toast = useToast();
  const { displayCurrency, fromDisplayCents } = useFormatCurrency();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        name,
        platform: platform || undefined,
        currentValue: fromDisplayCents(Math.round(Number(currentValue) * 100)),
      },
      {
        onSuccess: () => {
          toast.success('Compte créé');
          setName('');
          setPlatform('');
          setCurrentValue('0');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nouveau compte d'investissement">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Plateforme" value={platform} onChange={(e) => setPlatform(e.target.value)} />
        <Input
          label={`Valeur actuelle (${displayCurrency})`}
          type="number"
          step="0.01"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
        />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Création…' : 'Créer le compte'}
        </Button>
      </form>
    </Drawer>
  );
}
