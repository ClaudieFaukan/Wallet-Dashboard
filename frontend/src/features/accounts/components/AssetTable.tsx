import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import { Toggle } from '../../../components/ui/Toggle';
import { Input } from '../../../components/ui/Input';
import { FilterChip } from '../../../components/ui/FilterChip';
import type { AssetKind } from '../../../components/charts/chartTheme';
import type { PatrimoineRow } from '../../../hooks/usePatrimoineRows';
import { AssetRow } from './AssetRow';

type SortKey = 'value' | 'allTimeGain' | 'ytdVariation';

const kindLabels: Record<AssetKind, string> = {
  account: 'Comptes',
  investment: 'Investissements',
  crypto: 'Crypto',
  real_estate: 'Immobilier',
  collectibles: 'Collectibles',
  credit: 'Crédits',
};

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  className = '',
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-end gap-1 text-right transition-colors hover:text-text-secondary ${
        active ? 'text-text-primary' : ''
      } ${className}`}
    >
      {label}
      {active && (dir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
    </button>
  );
}

export function AssetTable({ rows, isLoading }: { rows: PatrimoineRow[]; isLoading: boolean }) {
  const [tab, setTab] = useState<'assets' | 'liabilities'>('assets');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetKind | 'all'>('all');
  const [groupByType, setGroupByType] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const scoped = rows.filter((r) => (tab === 'assets' ? !r.isLiability : r.isLiability));
  const kindsPresent = Array.from(new Set(scoped.map((r) => r.kind)));

  const filtered = scoped.filter((r) => {
    if (typeFilter !== 'all' && r.kind !== typeFilter) return false;
    if (search.trim() === '') return true;
    const needle = search.trim().toLowerCase();
    return r.name.toLowerCase().includes(needle) || r.subtitle?.toLowerCase().includes(needle);
  });

  function sortValue(r: PatrimoineRow): number {
    if (sortKey === 'value') return r.value;
    if (sortKey === 'allTimeGain') return r.allTimeGain ?? -Infinity;
    return r.ytdVariation ?? -Infinity;
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = [...filtered].sort((a, b) => (sortDir === 'desc' ? 1 : -1) * (sortValue(a) - sortValue(b)));

  const groups = useMemo(() => {
    if (!groupByType) return [{ kind: null, rows: sorted }];
    const byKind = new Map<AssetKind, PatrimoineRow[]>();
    sorted.forEach((r) => {
      byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r]);
    });
    return Array.from(byKind.entries()).map(([kind, kindRows]) => ({ kind, rows: kindRows }));
  }, [groupByType, sorted]);

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Tabs
          variant="underline"
          tabs={[
            { value: 'assets', label: 'Actifs' },
            { value: 'liabilities', label: 'Passifs' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="flex items-center gap-3">
          <Toggle checked={groupByType} onChange={setGroupByType} label="Grouper par type" />
          <div className="relative w-56">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Rechercher"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
          Tous les types
        </FilterChip>
        {kindsPresent.map((kind) => (
          <FilterChip key={kind} active={typeFilter === kind} onClick={() => setTypeFilter(typeFilter === kind ? 'all' : kind)}>
            {kindLabels[kind]}
          </FilterChip>
        ))}
      </div>

      <div className="flex items-center gap-4 border-b border-border px-2 pb-3 text-xs font-medium text-text-muted">
        <div className="flex-1">Nom</div>
        <div className="w-40 shrink-0">Type</div>
        <div className="w-24 shrink-0">Répartition</div>
        <SortableHeader
          label="Valeur"
          active={sortKey === 'value'}
          dir={sortDir}
          onClick={() => toggleSort('value')}
          className="w-28 shrink-0"
        />
        <SortableHeader
          label="+/- value"
          active={sortKey === 'allTimeGain'}
          dir={sortDir}
          onClick={() => toggleSort('allTimeGain')}
          className="w-32 shrink-0"
        />
        <SortableHeader
          label="Var. YTD"
          active={sortKey === 'ytdVariation'}
          dir={sortDir}
          onClick={() => toggleSort('ytdVariation')}
          className="w-32 shrink-0"
        />
        <div className="w-32 shrink-0" />
      </div>

      {isLoading && <p className="py-6 text-center text-sm text-text-muted">Chargement…</p>}

      {!isLoading && sorted.length === 0 && (
        <p className="py-6 text-center text-sm text-text-muted">
          {tab === 'assets' ? 'Aucun actif pour l’instant.' : 'Aucun passif pour l’instant.'}
        </p>
      )}

      {!isLoading &&
        groups.map((group) => (
          <div key={group.kind ?? 'flat'}>
            {group.kind && (
              <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {kindLabels[group.kind]}
              </p>
            )}
            {group.rows.map((row) => (
              <AssetRow key={row.id} row={row} />
            ))}
          </div>
        ))}
    </Card>
  );
}
