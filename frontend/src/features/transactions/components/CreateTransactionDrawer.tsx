import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { Account, Category, TransactionType } from '../../../types/api';
import { useCreateTransaction } from '../hooks/useTransactions';

interface CreateTransactionDrawerProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
}

export function CreateTransactionDrawer({
  open,
  onClose,
  accounts,
  categories,
}: CreateTransactionDrawerProps) {
  const [accountId, setAccountId] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('0');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const create = useCreateTransaction();
  const toast = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    create.mutate(
      {
        accountId: accountId || accounts[0]?.id || '',
        type,
        amount: type === 'expense' ? -Math.abs(cents) : Math.abs(cents),
        categoryId: categoryId || undefined,
        description: description || undefined,
        date: new Date(date).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success('Transaction ajoutée');
          setAmount('0');
          setDescription('');
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nouvelle transaction">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="Compte" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
          <option value="" disabled>
            Choisir un compte
          </option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
          <option value="expense">Dépense</option>
          <option value="income">Revenu</option>
          <option value="transfer">Virement</option>
        </Select>
        <Input
          label="Montant (€)"
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Select label="Catégorie" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sans catégorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Button type="submit" disabled={create.isPending || !accountId}>
          {create.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
      </form>
    </Drawer>
  );
}
