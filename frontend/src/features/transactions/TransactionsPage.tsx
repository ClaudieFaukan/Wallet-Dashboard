import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { FilterChip } from '../../components/ui/FilterChip';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useAccounts } from '../accounts/hooks/useAccounts';
import { TransactionsTable } from './components/TransactionsTable';
import { CreateTransactionDrawer } from './components/CreateTransactionDrawer';
import { useCategories, useCurrentMonthStats, useInfiniteTransactions } from './hooks/useTransactions';
import type { TransactionType } from '../../types/api';

const typeChips: { value: TransactionType | ''; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'expense', label: 'Dépenses' },
  { value: 'income', label: 'Revenus' },
  { value: 'transfer', label: 'Virements' },
];

export function TransactionsPage() {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { totalIncome, totalExpense, net, isLoading: statsLoading } = useCurrentMonthStats();
  const { formatCents } = useFormatCurrency();
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<TransactionType | ''>('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hasActiveFilters = Boolean(accountId || categoryId || type || search || dateFrom || dateTo);

  function resetFilters() {
    setAccountId('');
    setCategoryId('');
    setType('');
    setSearch('');
    setDateFrom('');
    setDateTo('');
  }

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
  const accountsById = new Map((accounts ?? []).map((a) => [a.id, a]));

  return (
    <div>
      <Header
        title="Transactions"
        actions={
          <Button size="md" icon={<Plus size={16} />} onClick={() => setDrawerOpen(true)}>
            Ajouter une transaction
          </Button>
        }
      />
      <div className="space-y-4 p-8">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-text-secondary">Revenus — ce mois-ci</p>
            <p className="mt-1 font-mono text-lg font-semibold text-accent-2">
              {statsLoading ? '—' : formatCents(totalIncome)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-text-secondary">Dépenses — ce mois-ci</p>
            <p className="mt-1 font-mono text-lg font-semibold text-accent-3">
              {statsLoading ? '—' : formatCents(totalExpense)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-text-secondary">Net — ce mois-ci</p>
            <p className={`mt-1 font-mono text-lg font-semibold ${net >= 0 ? 'text-text-primary' : 'text-accent-3'}`}>
              {statsLoading ? '—' : formatCents(net)}
            </p>
          </Card>
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {typeChips.map((chip) => (
                <FilterChip key={chip.value} active={type === chip.value} onClick={() => setType(chip.value)}>
                  {chip.label}
                </FilterChip>
              ))}
            </div>
            <div className="relative w-56">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                placeholder="Rechercher une transaction…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <Select label="Compte" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-40">
              <option value="">Tous les comptes</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select label="Catégorie" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-40">
              <option value="">Toutes les catégories</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input label="Du" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="Au" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={resetFilters}>
                Réinitialiser
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <TransactionsTable transactions={items} categories={categories ?? []} accountsById={accountsById} />
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
