import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { Account, AccountType } from '../../../types/api';
import { useAccount, useUpdateAccount } from '../hooks/useAccounts';

export function EditAccountDrawer({
  accountId,
  open,
  onClose,
}: {
  accountId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: account } = useAccount(accountId ?? '');

  return (
    <Drawer open={open} onClose={onClose} title={account ? `Éditer — ${account.name}` : 'Éditer'}>
      {account && <EditAccountForm key={account.id} account={account} onClose={onClose} />}
    </Drawer>
  );
}

function EditAccountForm({ account, onClose }: { account: Account; onClose: () => void }) {
  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>(account.type);
  const [institution, setInstitution] = useState(account.institution ?? '');
  const [balance, setBalance] = useState((account.balance / 100).toString());

  const update = useUpdateAccount();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate(
      {
        id: account.id,
        input: {
          name,
          type,
          institution: institution || undefined,
          balance: Math.round(Number(balance) * 100),
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
      <Select label="Type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
        <option value="checking">Courant</option>
        <option value="savings">Épargne</option>
        <option value="investment">Investissement</option>
      </Select>
      <Input label="Institution" value={institution} onChange={(e) => setInstitution(e.target.value)} />
      <Input
        label="Solde (€)"
        type="number"
        step="0.01"
        value={balance}
        onChange={(e) => setBalance(e.target.value)}
      />
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
