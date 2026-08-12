import { parse } from 'csv-parse/sync';
import { AppError } from '../../shared/utils/AppError.js';
import { disambiguateDuplicates, toTransaction, type ParsedTransaction } from '../shared/transaction.js';
import { parseAmountToCents } from './amount.js';
import { parseDate } from './date.js';
import { detectFormat, type CsvFormat } from './formats.js';

export type { ParsedTransaction };

function parseRevolutRow(record: Record<string, string>): ParsedTransaction | null {
  const state = record.State?.trim().toUpperCase();
  if (state && state !== 'COMPLETED') return null;

  const date = parseDate(record.Date ?? '');
  const amountCents = parseAmountToCents(record.Amount ?? '0', '.');
  return toTransaction(date, amountCents, record.Description ?? '');
}

function parseTradeRepublicRow(record: Record<string, string>): ParsedTransaction {
  const date = parseDate(record.Date ?? '');
  const amountCents = parseAmountToCents(record.Montant ?? '0', '.');
  return toTransaction(date, amountCents, record.Nom || record.ISIN || '');
}

function parseDebitCreditRow(
  record: Record<string, string>,
  fields: { date: string; description: string; debit: string; credit: string },
  decimalSeparator: '.' | ',',
): ParsedTransaction {
  const date = parseDate(record[fields.date] ?? '');
  const debit = parseAmountToCents(record[fields.debit] ?? '0', decimalSeparator);
  const credit = parseAmountToCents(record[fields.credit] ?? '0', decimalSeparator);
  const amountCents = credit - Math.abs(debit);
  return toTransaction(date, amountCents, record[fields.description] ?? '');
}

function parseRows(format: CsvFormat, records: Record<string, string>[]): ParsedTransaction[] {
  switch (format) {
    case 'revolut':
      return records.map(parseRevolutRow).filter((t): t is ParsedTransaction => t !== null);
    case 'trade_republic':
      return records.map(parseTradeRepublicRow);
    case 'bnc':
      return records.map((r) =>
        parseDebitCreditRow(
          r,
          { date: 'Date', description: 'Description', debit: 'Débit', credit: 'Crédit' },
          '.',
        ),
      );
    case 'caisse_epargne':
      return records.map((r) =>
        parseDebitCreditRow(
          r,
          { date: "Date de l'opération", description: 'Libellé', debit: 'Débit', credit: 'Crédit' },
          ',',
        ),
      );
  }
}

export function parseCsv(content: string): {
  format: CsvFormat;
  transactions: ParsedTransaction[];
} {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
  const config = detectFormat(firstLine);
  if (!config) {
    throw new AppError(400, 'UNKNOWN_CSV_FORMAT', 'Could not detect the CSV format');
  }

  const records = parse(content, {
    columns: true,
    delimiter: config.delimiter,
    trim: true,
    skip_empty_lines: true,
    bom: true,
  }) as Record<string, string>[];

  return {
    format: config.format,
    transactions: disambiguateDuplicates(parseRows(config.format, records)),
  };
}
