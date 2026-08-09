import { useState, type FormEvent } from 'react';
import { Fingerprint, KeyRound, Plus, Tag, Trash2 } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Toggle } from '../../components/ui/Toggle';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { getErrorMessage } from '../../lib/api';
import { useUiStore } from '../../store/uiStore';
import { useCollectiblesConfig } from '../collectibles/hooks/useCollectibles';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
} from '../transactions/hooks/useTransactions';
import { useTouchIdAvailability } from './hooks/useTouchIdAvailability';
import type { CategoryType } from '../../types/api';

function CategoriesSection() {
  const { data: categories } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('expense');

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    createCategory.mutate(
      { name, type },
      {
        onSuccess: () => {
          setName('');
          toast.success('Catégorie créée');
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  function handleDelete(id: string) {
    deleteCategory.mutate(id, {
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  }

  return (
    <Card>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-text-muted">
        <Tag size={16} /> Catégories de dépenses
      </h3>

      <div className="flex flex-wrap gap-2">
        {categories?.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-2 rounded-md bg-bg-elevated px-2.5 py-1.5 text-sm text-text-primary"
          >
            {c.name}
            {c.isDefault ? (
              <Badge variant="neutral">Défaut</Badge>
            ) : (
              <button
                type="button"
                title="Supprimer"
                onClick={() => handleDelete(c.id)}
                className="text-text-muted hover:text-accent-3"
              >
                <Trash2 size={12} />
              </button>
            )}
          </span>
        ))}
      </div>

      <form onSubmit={handleCreate} className="mt-4 flex items-end gap-2 border-t border-border pt-4">
        <Input
          label="Nouvelle catégorie"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom…"
          required
        />
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
          <option value="expense">Dépense</option>
          <option value="income">Revenu</option>
        </Select>
        <Button type="submit" size="sm" icon={<Plus size={14} />} disabled={createCategory.isPending}>
          Ajouter
        </Button>
      </form>
    </Card>
  );
}

export function SettingsPage() {
  const touchIdAvailable = useTouchIdAvailability();
  const touchIdEnabled = useUiStore((s) => s.touchIdEnabled);
  const setTouchIdEnabled = useUiStore((s) => s.setTouchIdEnabled);
  const { data: config } = useCollectiblesConfig();

  return (
    <div>
      <Header title="Réglages" />
      <div className="space-y-6 p-8">
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-text-muted">
            <Fingerprint size={16} /> Sécurité
          </h3>
          {touchIdAvailable ? (
            <Toggle
              checked={touchIdEnabled}
              onChange={setTouchIdEnabled}
              label="Déverrouillage Touch ID au lancement de l'app"
            />
          ) : (
            <p className="text-sm text-text-muted">
              Touch ID n'est pas disponible sur cet appareil (nécessite l'app Electron sur un Mac
              compatible).
            </p>
          )}
        </Card>

        <CategoriesSection />

        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-text-muted">
            <KeyRound size={16} /> Sources de prix — Scellés
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-primary">PokemonPriceTracker</span>
              <Badge variant={config?.pokemonPriceTrackerConfigured ? 'success' : 'neutral'}>
                {config?.pokemonPriceTrackerConfigured ? 'Configuré' : 'Non configuré'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-primary">Poketrace</span>
              <Badge variant={config?.poketraceConfigured ? 'success' : 'neutral'}>
                {config?.poketraceConfigured ? 'Configuré' : 'Non configuré'}
              </Badge>
            </div>
          </div>
          {!config?.pokemonPriceTrackerConfigured && !config?.poketraceConfigured && (
            <p className="mt-4 text-xs text-text-muted">
              Les prix du scellé sont mis à jour manuellement. Configurez une clé API côté serveur
              (variables d'environnement backend) pour automatiser ces mises à jour.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
