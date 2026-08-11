import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { InvestmentAssetType, InvestmentEntryType } from '../../../types/api';

interface EntryFormFieldsProps {
  date: string;
  onDateChange: (v: string) => void;
  amountInvested: string;
  onAmountInvestedChange: (v: string) => void;
  portfolioValue: string;
  onPortfolioValueChange: (v: string) => void;
  entryType: InvestmentEntryType;
  onEntryTypeChange: (v: InvestmentEntryType) => void;
  ticker: string;
  onTickerChange: (v: string) => void;
  assetType: InvestmentAssetType;
  onAssetTypeChange: (v: InvestmentAssetType) => void;
  isin: string;
  onIsinChange: (v: string) => void;
  shares: string;
  onSharesChange: (v: string) => void;
}

/** Shared field set for the DCA entry form, used by both AddEntryDrawer and EditEntryDrawer to
 * avoid duplicating the JSX (state/handlers stay owned by each drawer — key-remount pattern for
 * the edit case, matching the convention already used elsewhere in this app). */
export function EntryFormFields({
  date,
  onDateChange,
  amountInvested,
  onAmountInvestedChange,
  portfolioValue,
  onPortfolioValueChange,
  entryType,
  onEntryTypeChange,
  ticker,
  onTickerChange,
  assetType,
  onAssetTypeChange,
  isin,
  onIsinChange,
  shares,
  onSharesChange,
}: EntryFormFieldsProps) {
  return (
    <>
      <Input label="Date" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} required />
      <Select
        label="Type"
        value={entryType}
        onChange={(e) => onEntryTypeChange(e.target.value as InvestmentEntryType)}
      >
        <option value="contribution">Versement</option>
        <option value="dividend">Dividende reçu</option>
      </Select>
      <Input
        label={entryType === 'dividend' ? 'Montant du dividende (€)' : 'Montant versé (€)'}
        type="number"
        step="0.01"
        value={amountInvested}
        onChange={(e) => onAmountInvestedChange(e.target.value)}
      />
      {entryType === 'dividend' && (
        <p className="-mt-2 text-xs text-text-muted">
          Non compté dans le "Total investi" — visible séparément en "Dividendes reçus".
        </p>
      )}
      <Input
        label="Valeur du portefeuille après versement (€)"
        type="number"
        step="0.01"
        value={portfolioValue}
        onChange={(e) => onPortfolioValueChange(e.target.value)}
        required
      />
      <Input
        label="Ticker (optionnel — ex. IWDA.AS)"
        value={ticker}
        onChange={(e) => onTickerChange(e.target.value)}
        placeholder="Suivi du cours via Alpha Vantage"
      />
      {ticker && (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg-elevated/40 p-3">
          <Select
            label="Type d'actif"
            value={assetType}
            onChange={(e) => onAssetTypeChange(e.target.value as InvestmentAssetType)}
          >
            <option value="etf">ETF</option>
            <option value="stock">Action</option>
          </Select>
          <Input
            label="ISIN (optionnel)"
            value={isin}
            onChange={(e) => onIsinChange(e.target.value)}
            placeholder="ex. IE00B4L5Y983 — identifiant du titre chez ton broker"
          />
          <Input
            label={entryType === 'dividend' ? 'Parts supplémentaires si réinvesti (optionnel)' : 'Nombre de parts (optionnel)'}
            type="number"
            step="0.000001"
            min="0"
            value={shares}
            onChange={(e) => onSharesChange(e.target.value)}
            placeholder="ex. 12.5"
          />
        </div>
      )}
    </>
  );
}
