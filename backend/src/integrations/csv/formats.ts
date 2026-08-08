export type CsvFormat = 'revolut' | 'trade_republic' | 'caisse_epargne' | 'bnc';

interface FormatConfig {
  format: CsvFormat;
  delimiter: ',' | ';';
  requiredHeaders: string[];
}

// A comma delimiter can't also be the decimal separator (that would make the
// file ambiguous), so comma-delimited exports always use dot-decimal amounts,
// and only the semicolon-delimited export can safely use comma-decimal.
export const FORMAT_CONFIGS: FormatConfig[] = [
  {
    format: 'revolut',
    delimiter: ',',
    requiredHeaders: ['Date', 'Description', 'Amount', 'Currency', 'State'],
  },
  {
    format: 'trade_republic',
    delimiter: ',',
    requiredHeaders: ['Date', 'Montant', 'ISIN'],
  },
  {
    format: 'bnc',
    delimiter: ',',
    requiredHeaders: ['Date', 'Description', 'Débit', 'Crédit', 'Solde'],
  },
  {
    format: 'caisse_epargne',
    delimiter: ';',
    requiredHeaders: ["Date de l'opération", 'Libellé', 'Débit', 'Crédit'],
  },
];

export function detectFormat(headerLine: string): FormatConfig | null {
  for (const config of FORMAT_CONFIGS) {
    const headers = headerLine.split(config.delimiter).map((h) => h.trim());
    if (config.requiredHeaders.every((h) => headers.includes(h))) {
      return config;
    }
  }
  return null;
}
