import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { AccountType } from '../../../types/api';
import { useCreateAccount } from '../hooks/useAccounts';

export function CreateAccountDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [institution, setInstitution] = useState('');
  const [balance, setBalance] = useState('0');
  const create = useCreateAccount();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        name,
        type,
        institution: institution || undefined,
        balance: Math.round(Number(balance) * 100),
      },
      {
        onSuccess: () => {
          toast.success('Compte créé');
          setName('');
          setInstitution('');
          setBalance('0');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nouveau compte">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
          <option value="checking">Courant</option>
          <option value="savings">Épargne</option>
          <option value="investment">Investissement</option>
        </Select>
        <Input
          label="Institution"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
        />
        <Input
          label="Solde initial (€)"
          type="number"
          step="0.01"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
        />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Création…' : 'Créer le compte'}
        </Button>
      </form>
    </Drawer>
  );
}
