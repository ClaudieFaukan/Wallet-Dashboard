import { useRef, useState, type ChangeEvent } from 'react';
import { FileText } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../lib/api';
import type { AccountType, PdfImportMappingItem, PdfImportPreviewSection } from '../../../types/api';
import { useAccounts, useConfirmPdfImport, usePreviewPdfImport } from '../hooks/useAccounts';
import { useSavingsGoals } from '../../savings/hooks/useSavings';
import { useInvestmentAccounts } from '../../investments/hooks/useInvestments';

type TargetMode = 'skip' | 'account' | 'savings_goal' | 'investment_account';

type SectionMapping =
  | { mode: 'skip' }
  | { mode: 'account'; sub: 'existing'; accountId: string }
  | { mode: 'account'; sub: 'new'; name: string; type: AccountType }
  | { mode: 'savings_goal'; sub: 'existing'; goalId: string }
  | { mode: 'savings_goal'; sub: 'new'; name: string; targetAmount: string }
  | { mode: 'investment_account'; sub: 'existing'; investmentAccountId: string }
  | { mode: 'investment_account'; sub: 'new'; name: string; platform: string };

function defaultMapping(section: PdfImportPreviewSection): SectionMapping {
  // Which domain module a section belongs to is computed backend-side, per
  // source bank — the same keyword can mean different things across banks
  // (e.g. Revolut's "Dépôt" is a savings vault, but Caisse d'Épargne's
  // "compte de dépôt" is the everyday checking account).
  const mode = section.suggestedTargetType;
  if (mode === 'savings_goal') {
    return section.suggestedSavingsGoalId
      ? { mode, sub: 'existing', goalId: section.suggestedSavingsGoalId }
      : { mode, sub: 'new', name: section.accountLabel, targetAmount: '' };
  }
  if (mode === 'investment_account') {
    return section.suggestedInvestmentAccountId
      ? { mode, sub: 'existing', investmentAccountId: section.suggestedInvestmentAccountId }
      : { mode, sub: 'new', name: section.accountLabel, platform: '' };
  }
  return section.suggestedAccountId
    ? { mode, sub: 'existing', accountId: section.suggestedAccountId }
    : { mode, sub: 'new', name: section.accountLabel, type: 'checking' };
}

export function ImportPdfModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [sections, setSections] = useState<PdfImportPreviewSection[] | null>(null);
  const [mapping, setMapping] = useState<Record<string, SectionMapping>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: accounts } = useAccounts();
  const { data: savingsGoals } = useSavingsGoals();
  const { data: investmentAccounts } = useInvestmentAccounts();
  const preview = usePreviewPdfImport();
  const confirm = useConfirmPdfImport();
  const toast = useToast();

  function reset() {
    setFile(null);
    setSections(null);
    setMapping({});
    preview.reset();
    confirm.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    setFile(selected);

    preview.mutate(selected, {
      onSuccess: (result) => {
        setSections(result);
        const initial: Record<string, SectionMapping> = {};
        for (const section of result) {
          initial[section.accountNumber] = defaultMapping(section);
        }
        setMapping(initial);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err));
        setFile(null);
      },
    });
  }

  function updateMapping(accountNumber: string, value: SectionMapping) {
    setMapping((prev) => ({ ...prev, [accountNumber]: value }));
  }

  function handleModeChange(section: PdfImportPreviewSection, mode: TargetMode) {
    if (mode === 'skip') {
      updateMapping(section.accountNumber, { mode: 'skip' });
      return;
    }
    if (mode === 'savings_goal') {
      updateMapping(
        section.accountNumber,
        section.suggestedSavingsGoalId
          ? { mode, sub: 'existing', goalId: section.suggestedSavingsGoalId }
          : { mode, sub: 'new', name: section.accountLabel, targetAmount: '' },
      );
      return;
    }
    if (mode === 'investment_account') {
      updateMapping(
        section.accountNumber,
        section.suggestedInvestmentAccountId
          ? { mode, sub: 'existing', investmentAccountId: section.suggestedInvestmentAccountId }
          : { mode, sub: 'new', name: section.accountLabel, platform: '' },
      );
      return;
    }
    updateMapping(
      section.accountNumber,
      section.suggestedAccountId
        ? { mode, sub: 'existing', accountId: section.suggestedAccountId }
        : { mode, sub: 'new', name: section.accountLabel, type: 'checking' },
    );
  }

  function handleExistingIdChange(section: PdfImportPreviewSection, mode: TargetMode, id: string) {
    if (mode === 'savings_goal') updateMapping(section.accountNumber, { mode, sub: 'existing', goalId: id });
    else if (mode === 'investment_account') {
      updateMapping(section.accountNumber, { mode, sub: 'existing', investmentAccountId: id });
    } else if (mode === 'account') {
      updateMapping(section.accountNumber, { mode, sub: 'existing', accountId: id });
    }
  }

  function handleCreateNew(section: PdfImportPreviewSection, mode: TargetMode) {
    if (mode === 'savings_goal') {
      updateMapping(section.accountNumber, { mode, sub: 'new', name: section.accountLabel, targetAmount: '' });
    } else if (mode === 'investment_account') {
      updateMapping(section.accountNumber, { mode, sub: 'new', name: section.accountLabel, platform: '' });
    } else if (mode === 'account') {
      updateMapping(section.accountNumber, { mode, sub: 'new', name: section.accountLabel, type: 'checking' });
    }
  }

  function handleImport() {
    if (!file || !sections) return;

    const items: PdfImportMappingItem[] = [];
    for (const section of sections) {
      const entry = mapping[section.accountNumber];
      if (!entry || entry.mode === 'skip') continue;

      if (entry.mode === 'account') {
        items.push({
          accountNumber: section.accountNumber,
          target:
            entry.sub === 'existing'
              ? { type: 'account', accountId: entry.accountId }
              : { type: 'account', createAccount: { name: entry.name, type: entry.type } },
        });
      } else if (entry.mode === 'savings_goal') {
        if (entry.sub === 'new' && !Number(entry.targetAmount)) {
          toast.error(`Indique un objectif (€) pour "${entry.name}"`);
          return;
        }
        items.push({
          accountNumber: section.accountNumber,
          target:
            entry.sub === 'existing'
              ? { type: 'savings_goal', goalId: entry.goalId }
              : {
                  type: 'savings_goal',
                  createGoal: { name: entry.name, targetAmount: Math.round(Number(entry.targetAmount) * 100) },
                },
        });
      } else {
        items.push({
          accountNumber: section.accountNumber,
          target:
            entry.sub === 'existing'
              ? { type: 'investment_account', investmentAccountId: entry.investmentAccountId }
              : {
                  type: 'investment_account',
                  createInvestmentAccount: { name: entry.name, platform: entry.platform || undefined },
                },
        });
      }
    }

    if (items.length === 0) {
      toast.error('Sélectionne au moins un compte à importer');
      return;
    }

    confirm.mutate(
      { file, mapping: items },
      {
        onSuccess: (results) => {
          const imported = results.reduce((sum, r) => sum + r.imported, 0);
          const skipped = results.reduce((sum, r) => sum + r.skipped, 0);
          toast.success(`${imported} transaction(s) importée(s), ${skipped} ignorée(s)`);
          handleClose();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Importer un relevé PDF" size="lg">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {!sections && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10">
          <FileText size={28} className="text-text-muted" />
          <p className="text-sm text-text-secondary">
            Sélectionne le PDF de ton relevé de comptes (Caisse d'Épargne ou Revolut).
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled={preview.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {preview.isPending ? 'Analyse en cours…' : 'Choisir un fichier'}
          </Button>
        </div>
      )}

      {sections && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-text-muted">
            {sections.length} compte(s) détecté(s) dans {file?.name} — choisis où importer chaque
            section.
          </p>

          {sections.map((section) => {
            const entry = mapping[section.accountNumber] ?? { mode: 'skip' as const };
            return (
              <div
                key={section.accountNumber}
                className="rounded-lg border border-border bg-bg-elevated p-3"
              >
                <div className="mb-2">
                  <p className="text-sm font-medium text-text-primary">{section.accountLabel}</p>
                  <p className="text-xs text-text-muted">
                    N° {section.accountNumber} · {section.transactionCount} opération(s)
                    {section.dateRange && ` · ${section.dateRange.from} → ${section.dateRange.to}`}
                  </p>
                </div>

                <Select
                  value={entry.mode}
                  onChange={(e) => handleModeChange(section, e.target.value as TargetMode)}
                >
                  <option value="skip">Ignorer cette section</option>
                  <option value="account">Compte bancaire</option>
                  <option value="savings_goal">Épargne</option>
                  <option value="investment_account">Investissement</option>
                </Select>

                {entry.mode !== 'skip' && (
                  <Select
                    className="mt-2"
                    value={
                      entry.sub === 'existing'
                        ? (entry.mode === 'account'
                            ? entry.accountId
                            : entry.mode === 'savings_goal'
                              ? entry.goalId
                              : entry.investmentAccountId)
                        : 'new'
                    }
                    onChange={(e) =>
                      e.target.value === 'new'
                        ? handleCreateNew(section, entry.mode)
                        : handleExistingIdChange(section, entry.mode, e.target.value)
                    }
                  >
                    <option value="new">
                      {entry.mode === 'account' && 'Créer un nouveau compte'}
                      {entry.mode === 'savings_goal' && 'Créer un nouvel objectif d\'épargne'}
                      {entry.mode === 'investment_account' && 'Créer un nouveau compte d\'investissement'}
                    </option>
                    {entry.mode === 'account' &&
                      accounts?.map((a) => (
                        <option key={a.id} value={a.id}>
                          Compte existant : {a.name}
                        </option>
                      ))}
                    {entry.mode === 'savings_goal' &&
                      savingsGoals?.map((g) => (
                        <option key={g.id} value={g.id}>
                          Objectif existant : {g.name}
                        </option>
                      ))}
                    {entry.mode === 'investment_account' &&
                      investmentAccounts?.map((a) => (
                        <option key={a.id} value={a.id}>
                          Compte existant : {a.name}
                        </option>
                      ))}
                  </Select>
                )}

                {entry.mode === 'account' && entry.sub === 'new' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nom du compte"
                      value={entry.name}
                      onChange={(e) =>
                        updateMapping(section.accountNumber, { ...entry, name: e.target.value })
                      }
                    />
                    <Select
                      value={entry.type}
                      onChange={(e) =>
                        updateMapping(section.accountNumber, {
                          ...entry,
                          type: e.target.value as AccountType,
                        })
                      }
                    >
                      <option value="checking">Courant</option>
                      <option value="savings">Épargne</option>
                      <option value="investment">Investissement</option>
                    </Select>
                  </div>
                )}

                {entry.mode === 'savings_goal' && entry.sub === 'new' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nom de l'objectif"
                      value={entry.name}
                      onChange={(e) =>
                        updateMapping(section.accountNumber, { ...entry, name: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Objectif (€)"
                      value={entry.targetAmount}
                      onChange={(e) =>
                        updateMapping(section.accountNumber, { ...entry, targetAmount: e.target.value })
                      }
                    />
                  </div>
                )}

                {entry.mode === 'investment_account' && entry.sub === 'new' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nom du compte"
                      value={entry.name}
                      onChange={(e) =>
                        updateMapping(section.accountNumber, { ...entry, name: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Plateforme (optionnel)"
                      value={entry.platform}
                      onChange={(e) =>
                        updateMapping(section.accountNumber, { ...entry, platform: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={reset}>
              Choisir un autre fichier
            </Button>
            <Button onClick={handleImport} disabled={confirm.isPending}>
              {confirm.isPending ? 'Import en cours…' : 'Importer'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
