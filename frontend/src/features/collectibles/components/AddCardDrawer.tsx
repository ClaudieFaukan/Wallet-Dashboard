import { useState, type FormEvent } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Toggle } from '../../../components/ui/Toggle';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { getErrorMessage } from '../../../lib/api';
import type {
  CardSearchResult,
  CollectibleCardLanguage,
  CollectibleCondition,
  CollectibleGradingCompany,
  TcgType,
} from '../../../types/api';
import { useCreateCollectible, useSearchCard } from '../hooks/useCollectibles';

const GAME_LABELS: Record<TcgType, string> = {
  pokemon: 'Pokémon',
  onepiece: 'One Piece',
  dragonball: 'Dragon Ball',
  digimon: 'Digimon',
  lorcana: 'Lorcana',
  starwars: 'Star Wars Unlimited',
};

const CARD_LANGUAGE_LABELS: Record<CollectibleCardLanguage, string> = {
  FR: 'Français',
  EN: 'Anglais',
  JP: 'Japonais',
};

const GRADING_COMPANY_LABELS: Record<CollectibleGradingCompany, string> = {
  PSA: 'PSA',
  BGS: 'BGS',
  CGC: 'CGC',
  SGC: 'SGC',
  other: 'Autre',
};

export function AddCardDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tcgType, setTcgType] = useState<TcgType>('pokemon');
  const [query, setQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const [selected, setSelected] = useState<CardSearchResult | null>(null);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState<CollectibleCondition>('NM');
  const [language, setLanguage] = useState<CollectibleCardLanguage | ''>('');
  const [graded, setGraded] = useState(false);
  const [gradingCompany, setGradingCompany] = useState<CollectibleGradingCompany>('PSA');
  const [gradingScore, setGradingScore] = useState('10');
  const [notes, setNotes] = useState('');

  const isPokemon = tcgType === 'pokemon';
  const debouncedQuery = useDebouncedValue(query, 300);
  const search = useSearchCard(debouncedQuery, tcgType);
  const create = useCreateCollectible();
  const toast = useToast();

  function reset() {
    setTcgType('pokemon');
    setQuery('');
    setManualName('');
    setSelected(null);
    setPurchasePrice('');
    setCondition('NM');
    setLanguage('');
    setGraded(false);
    setGradingCompany('PSA');
    setGradingScore('10');
    setNotes('');
  }

  function handleManualContinue(e: FormEvent) {
    e.preventDefault();
    if (!manualName.trim()) return;
    setSelected({ tcgdexId: '', name: manualName.trim(), setName: null, cardNumber: null, imageUrl: null });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    create.mutate(
      {
        itemType: 'card',
        name: selected.name,
        setName: selected.setName ?? undefined,
        imageUrl: selected.imageUrl ?? undefined,
        cardNumber: selected.cardNumber ?? undefined,
        tcgdexId: selected.tcgdexId || undefined,
        tcgType,
        language: language || undefined,
        purchasePrice: Math.round(Number(purchasePrice) * 100),
        purchaseDate: new Date(purchaseDate).toISOString(),
        condition: graded ? undefined : condition,
        gradingCompany: graded ? gradingCompany : undefined,
        gradingScore: graded ? Number(gradingScore) : undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Carte ajoutée');
          reset();
          onClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Ajouter une carte">
      <Select
        label="Jeu"
        value={tcgType}
        onChange={(e) => {
          setTcgType(e.target.value as TcgType);
          setSelected(null);
        }}
        className="mb-4"
      >
        {Object.entries(GAME_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      {!selected ? (
        isPokemon ? (
          <div className="flex flex-col gap-3">
            <Input
              label="Rechercher une carte"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pikachu…"
              autoFocus
            />
            {query.length > 0 && query.length <= 1 && (
              <p className="text-xs text-text-muted">Encore un caractère…</p>
            )}
            {search.isFetching && <p className="text-xs text-text-muted">Recherche…</p>}
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {!search.isFetching &&
                search.data?.map((result) => (
                  <li key={result.tcgdexId}>
                    <button
                      type="button"
                      onClick={() => setSelected(result)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-left text-sm hover:border-accent-gold"
                    >
                      {result.imageUrl && (
                        <img src={result.imageUrl} alt="" className="h-10 w-10 rounded object-contain" />
                      )}
                      <div>
                        <p className="text-text-primary">{result.name}</p>
                        <p className="text-xs text-text-muted">{result.setName ?? 'Set inconnu'}</p>
                      </div>
                    </button>
                  </li>
                ))}
              {!search.isFetching && debouncedQuery.length > 1 && search.data?.length === 0 && (
                <li className="text-sm text-text-muted">Aucun résultat</li>
              )}
            </ul>
          </div>
        ) : (
          <form onSubmit={handleManualContinue} className="flex flex-col gap-3">
            <p className="text-xs text-text-muted">
              Recherche automatique indisponible pour {GAME_LABELS[tcgType]} — ajoute la carte
              manuellement, le prix se met à jour à la main ensuite.
            </p>
            <Input
              label="Nom de la carte"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              autoFocus
              required
            />
            <Button type="submit">Continuer</Button>
          </form>
        )
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-elevated px-3 py-2">
            {selected.imageUrl && (
              <img src={selected.imageUrl} alt="" className="h-12 w-12 rounded object-contain" />
            )}
            <div className="flex-1">
              <p className="text-sm text-text-primary">{selected.name}</p>
              <p className="text-xs text-text-muted">{selected.setName ?? 'Set à compléter manuellement'}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-accent">
              Changer
            </button>
          </div>

          <Input
            label="Prix d'achat (€)"
            type="number"
            step="0.01"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            required
          />
          <Input
            label="Date d'achat"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            required
          />
          <Select
            label="Langue"
            value={language}
            onChange={(e) => setLanguage(e.target.value as CollectibleCardLanguage | '')}
          >
            <option value="">Non précisée</option>
            {Object.entries(CARD_LANGUAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Toggle checked={graded} onChange={setGraded} label="Carte gradée" />

          {graded ? (
            <div className="flex gap-3">
              <Select
                label="Grading"
                value={gradingCompany}
                onChange={(e) => setGradingCompany(e.target.value as CollectibleGradingCompany)}
                className="flex-1"
              >
                {Object.entries(GRADING_COMPANY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input
                label="Note"
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={gradingScore}
                onChange={(e) => setGradingScore(e.target.value)}
                className="w-24"
                required
              />
            </div>
          ) : (
            <Select label="Condition" value={condition} onChange={(e) => setCondition(e.target.value as CollectibleCondition)}>
              <option value="NM">Near Mint (NM)</option>
              <option value="LP">Lightly Played (LP)</option>
              <option value="MP">Moderately Played (MP)</option>
              <option value="HP">Heavily Played (HP)</option>
              <option value="DMG">Damaged (DMG)</option>
            </Select>
          )}

          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Ajout…' : 'Ajouter la carte'}
          </Button>
        </form>
      )}
    </Drawer>
  );
}
