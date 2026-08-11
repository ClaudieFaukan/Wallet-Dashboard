import { useState, type FormEvent } from 'react';
import { Coins, Fingerprint, KeyRound, Plus, Tag, Trash2 } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Toggle } from '../../components/ui/Toggle';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { getErrorMessage } from '../../lib/api';
import { getIsDemoFromToken, useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
} from '../transactions/hooks/useTransactions';
import { useTouchIdAvailability } from './hooks/useTouchIdAvailability';
import { useSettingsStatus, useTestSetting, useUpdateSettings } from './hooks/useSettings';
import type {
  CategoryType,
  DisplayCurrency,
  TestSettingInput,
  TestSettingResult,
} from '../../types/api';

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

type FieldName =
  | 'etherscanApiKey'
  | 'cryptoComApiKey'
  | 'cryptoComApiSecret'
  | 'pokemonPriceTrackerApiKey'
  | 'poketraceApiKey'
  | 'revolutClientId'
  | 'revolutClientSecret'
  | 'alphaVantageApiKey'
  | 'binanceApiKey'
  | 'binanceApiSecret'
  | 'bybitApiKey'
  | 'bybitApiSecret'
  | 'meriaApiKey';

interface IntegrationGroupProps {
  title: string;
  configured: boolean;
  fields: { name: FieldName; label: string }[];
  onSave: (values: Partial<Record<FieldName, string>>) => Promise<void>;
  saving: boolean;
  onTest: (values: Partial<Record<FieldName, string>>) => void;
  testing: boolean;
  testResult?: TestSettingResult;
  disabled?: boolean;
}

function IntegrationGroup({
  title,
  configured,
  fields,
  onSave,
  saving,
  onTest,
  testing,
  testResult,
  disabled = false,
}: IntegrationGroupProps) {
  const [values, setValues] = useState<Partial<Record<FieldName, string>>>({});
  const hasAnyValue = fields.some((f) => values[f.name]?.trim());
  const hasAllValues = fields.every((f) => values[f.name]?.trim());

  async function handleSave() {
    try {
      await onSave(values);
      setValues({});
    } catch {
      // keep the typed values so the user can retry without re-typing
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{title}</span>
        {disabled ? (
          <Badge variant="neutral">Non disponible en démo</Badge>
        ) : (
          <Badge variant={configured ? 'success' : 'neutral'}>
            {configured ? 'Configuré ✓' : 'Non configuré'}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {fields.map((f) => (
          <Input
            key={f.name}
            type="password"
            autoComplete="off"
            label={f.label}
            placeholder={configured ? '••••••••' : ''}
            value={values[f.name] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            disabled={disabled}
            className={disabled ? 'opacity-50' : ''}
          />
        ))}
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || !hasAnyValue || saving}
          onClick={handleSave}
        >
          Enregistrer
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || !hasAllValues || testing}
          onClick={() => onTest(values)}
        >
          Tester
        </Button>
      </div>
      {disabled && (
        <p className="text-xs text-text-muted">
          Les clés API ne sont pas modifiables sur la version démo.
        </p>
      )}
      {testResult && (
        <p className={`text-xs ${testResult.success ? 'text-accent-2' : 'text-accent-3'}`}>
          {testResult.message}
        </p>
      )}
    </div>
  );
}

function IntegrationsSection() {
  const { data: status } = useSettingsStatus();
  const updateSettings = useUpdateSettings();
  const testSetting = useTestSetting();
  const toast = useToast();
  const [testResults, setTestResults] = useState<Record<string, TestSettingResult>>({});
  const accessToken = useAuthStore((s) => s.accessToken);
  const isDemo = getIsDemoFromToken(accessToken);

  async function handleSave(values: Partial<Record<FieldName, string>>) {
    try {
      await updateSettings.mutateAsync(values);
      toast.success('Enregistré');
    } catch (err) {
      toast.error(getErrorMessage(err));
      throw err;
    }
  }

  function handleTest(section: TestSettingInput['section'], values: Partial<Record<FieldName, string>>) {
    testSetting.mutate({ section, ...values } as TestSettingInput, {
      onSuccess: (result) => setTestResults((r) => ({ ...r, [section]: result })),
      onError: (err) =>
        setTestResults((r) => ({
          ...r,
          [section]: { success: false, message: getErrorMessage(err) },
        })),
    });
  }

  return (
    <Card>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-text-muted">
        <KeyRound size={16} /> Intégrations
      </h3>
      <div className="space-y-4">
        <IntegrationGroup
          title="Etherscan (Ethereum / MetaMask)"
          configured={Boolean(status?.etherscanConfigured)}
          fields={[{ name: 'etherscanApiKey', label: 'Clé API' }]}
          onSave={handleSave}
          saving={updateSettings.isPending}
          onTest={(v) => handleTest('etherscan', v)}
          testing={testSetting.isPending}
          disabled={isDemo}
          testResult={testResults.etherscan}
        />
        <IntegrationGroup
          title="Crypto.com Exchange"
          configured={Boolean(status?.cryptoComConfigured)}
          fields={[
            { name: 'cryptoComApiKey', label: 'Clé API' },
            { name: 'cryptoComApiSecret', label: 'Secret' },
          ]}
          onSave={handleSave}
          saving={updateSettings.isPending}
          onTest={(v) => handleTest('cryptoCom', v)}
          testing={testSetting.isPending}
          disabled={isDemo}
          testResult={testResults.cryptoCom}
        />
        <IntegrationGroup
          title="PokemonPriceTracker"
          configured={Boolean(status?.pokemonPriceTrackerConfigured)}
          fields={[{ name: 'pokemonPriceTrackerApiKey', label: 'Clé API' }]}
          onSave={handleSave}
          saving={updateSettings.isPending}
          onTest={(v) => handleTest('pokemonPriceTracker', v)}
          testing={testSetting.isPending}
          disabled={isDemo}
          testResult={testResults.pokemonPriceTracker}
        />
        <IntegrationGroup
          title="Poketrace"
          configured={Boolean(status?.poketraceConfigured)}
          fields={[{ name: 'poketraceApiKey', label: 'Clé API' }]}
          onSave={handleSave}
          saving={updateSettings.isPending}
          onTest={(v) => handleTest('poketrace', v)}
          testing={testSetting.isPending}
          disabled={isDemo}
          testResult={testResults.poketrace}
        />
        <IntegrationGroup
          title="Revolut"
          configured={Boolean(status?.revolutConfigured)}
          fields={[
            { name: 'revolutClientId', label: 'Client ID' },
            { name: 'revolutClientSecret', label: 'Client Secret' },
          ]}
          onSave={handleSave}
          saving={updateSettings.isPending}
          onTest={(v) => handleTest('revolut', v)}
          testing={testSetting.isPending}
          disabled={isDemo}
          testResult={testResults.revolut}
        />
        <IntegrationGroup
          title="Alpha Vantage (cours ETF/actions)"
          configured={Boolean(status?.alphaVantageConfigured)}
          fields={[{ name: 'alphaVantageApiKey', label: 'Clé API' }]}
          onSave={handleSave}
          saving={updateSettings.isPending}
          onTest={(v) => handleTest('alphaVantage', v)}
          testing={testSetting.isPending}
          disabled={isDemo}
          testResult={testResults.alphaVantage}
        />
        <IntegrationGroup
          title="Binance"
          configured={Boolean(status?.binanceConfigured)}
          fields={[
            { name: 'binanceApiKey', label: 'Clé API' },
            { name: 'binanceApiSecret', label: 'Secret' },
          ]}
          onSave={handleSave}
          saving={updateSettings.isPending}
          onTest={(v) => handleTest('binance', v)}
          testing={testSetting.isPending}
          disabled={isDemo}
          testResult={testResults.binance}
        />
        <IntegrationGroup
          title="Bybit"
          configured={Boolean(status?.bybitConfigured)}
          fields={[
            { name: 'bybitApiKey', label: 'Clé API' },
            { name: 'bybitApiSecret', label: 'Secret' },
          ]}
          onSave={handleSave}
          saving={updateSettings.isPending}
          onTest={(v) => handleTest('bybit', v)}
          testing={testSetting.isPending}
          disabled={isDemo}
          testResult={testResults.bybit}
        />
        <IntegrationGroup
          title="Meria"
          configured={Boolean(status?.meriaConfigured)}
          fields={[{ name: 'meriaApiKey', label: 'Clé API' }]}
          onSave={handleSave}
          saving={updateSettings.isPending}
          onTest={(v) => handleTest('meria', v)}
          testing={testSetting.isPending}
          disabled={isDemo}
          testResult={testResults.meria}
        />
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const touchIdAvailable = useTouchIdAvailability();
  const touchIdEnabled = useUiStore((s) => s.touchIdEnabled);
  const setTouchIdEnabled = useUiStore((s) => s.setTouchIdEnabled);
  const displayCurrency = useUiStore((s) => s.displayCurrency);
  const setDisplayCurrency = useUiStore((s) => s.setDisplayCurrency);

  return (
    <div>
      <Header title="Réglages" />
      <div className="space-y-6 p-8">
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-text-muted">
            <Coins size={16} /> Devise d'affichage
          </h3>
          <Select
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value as DisplayCurrency)}
          >
            <option value="EUR">Euro (€)</option>
            <option value="USD">Dollar américain ($)</option>
            <option value="CAD">Dollar canadien (CA$)</option>
          </Select>
          <p className="mt-2 text-xs text-text-muted">
            Tous les montants sont convertis à l'affichage (taux de change quotidien). Les données
            restent enregistrées en euros.
          </p>
        </Card>

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

        <IntegrationsSection />
      </div>
    </div>
  );
}
