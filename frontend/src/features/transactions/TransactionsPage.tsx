import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAccounts } from '../accounts/hooks/useAccounts';
import { TransactionsTable } from './components/TransactionsTable';
import { CreateTransactionDrawer } from './components/CreateTransactionDrawer';
import { useCategories, useInfiniteTransactions } from './hooks/useTransactions';
import type { TransactionType } from '../../types/api';

export function TransactionsPage() {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<TransactionType | ''>('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filters = {
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    type: type || undefined,
    search: search || undefined,
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
    limit: 20,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteTransactions(filters);
  const items = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div>
      <Header
        title="Transactions"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDrawerOpen(true)}>
            Ajouter
          </Button>
        }
      />
      <div className="space-y-4 p-8">
        <Card>
          <div className="grid grid-cols-6 gap-3">
            <Input
              label="Recherche"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Description…"
            />
            <Select label="Compte" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Tous</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select label="Catégorie" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Toutes</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value as TransactionType | '')}>
              <option value="">Tous</option>
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
              <option value="transfer">Virement</option>
            </Select>
            <Input label="Du" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="Au" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </Card>

        <Card>
          <TransactionsTable transactions={items} categories={categories ?? []} />
          {hasNextPage && (
            <div className="mt-3 flex justify-center">
              <Button variant="secondary" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                Charger plus
              </Button>
            </div>
          )}
        </Card>
      </div>

      <CreateTransactionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        accounts={accounts ?? []}
        categories={categories ?? []}
      />
    </div>
  );
}
