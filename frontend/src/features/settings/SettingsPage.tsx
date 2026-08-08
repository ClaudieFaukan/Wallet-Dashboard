import { Fingerprint, KeyRound } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Toggle } from '../../components/ui/Toggle';
import { useUiStore } from '../../store/uiStore';
import { useCollectiblesConfig } from '../collectibles/hooks/useCollectibles';
import { useTouchIdAvailability } from './hooks/useTouchIdAvailability';

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
