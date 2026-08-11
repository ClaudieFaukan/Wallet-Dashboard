import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { getErrorMessage } from '../../../lib/api';
import type { InvestmentAccount } from '../../../types/api';
import { useUpdateInvestmentAccount } from '../hooks/useInvestments';

export function EditInvestmentAccountDrawer({
  account,
  open,
  onClose,
}: {
  account: InvestmentAccount | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={account ? `Éditer — ${account.name}` : 'Éditer'}>
      {account && <EditAccountForm key={account.id} account={account} onClose={onClose} />}
    </Drawer>
  );
}

function EditAccountForm({ account, onClose }: { account: InvestmentAccount; onClose: () => void }) {
  const { displayCurrency, toDisplayCents, fromDisplayCents } = useFormatCurrency();
  const [name, setName] = useState(account.name);
  const [platform, setPlatform] = useState(account.platform ?? '');
  const [currentValue, setCurrentValue] = useState((toDisplayCents(account.currentValue) / 100).toString());

  const update = useUpdateInvestmentAccount();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate(
      {
        id: account.id,
        input: {
          name,
          platform: platform || undefined,
          currentValue: fromDisplayCents(Math.round(Number(currentValue) * 100)),
        },
      },
      {
        onSuccess: () => {
          toast.success('Compte mis à jour');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
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
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
