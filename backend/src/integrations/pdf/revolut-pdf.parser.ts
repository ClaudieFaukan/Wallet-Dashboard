import { AppError } from '../../shared/utils/AppError.js';
import { parseAmountToCents } from '../csv/amount.js';
import { disambiguateDuplicates, toTransaction } from '../shared/transaction.js';
import { normalizeLetters } from './label.js';
import type { PdfImportSuggestedTargetType, PdfStatementSection } from './pdf-statement.js';

const SUMMARY_MARKER = 'Résumé du solde';
const SECTION_HEADER_PREFIX = 'Transactions ';

// e.g. "Compte (Compte courant)   0,00€   465,62€   470,00€   4,38€"
// (Produit, Solde d'ouverture, Argent sortant, Argent entrant, Solde de clôture)
const SUMMARY_ROW_RE =
  /^(.+?)\s+([\d ]+,\d{2})€\s+[\d ]+,\d{2}€\s+[\d ]+,\d{2}€\s+([\d ]+,\d{2})€$/;

// e.g. "29 juil. 2026 Paiement envoyé par M PETREL PIERRE-ALAIN 450,00€ 450,00€"
// Revolut prints one amount (either "argent sortant" or "argent entrant", never
// both) followed by the running "Solde" for that row — the middle amount's
// column can't be told apart from the flattened text alone, but the running
// Solde lets each transaction's signed amount be derived as a balance delta
// instead, sidestepping the ambiguity entirely.
const TRANSACTION_ROW_RE =
  /^(\d{1,2}\s+\S+\.?\s+\d{4})\s+(.+?)\s+[\d ]+,\d{2}€\s+([\d ]+,\d{2})€$/;

const IBAN_RE = /IBAN\s+([A-Z]{2}\d{2}[A-Z0-9]{1,30})/;

const MONTHS: Record<string, number> = {
  JANV: 0,
  FEVR: 1,
  MARS: 2,
  AVR: 3,
  MAI: 4,
  JUIN: 5,
  JUIL: 6,
  AOUT: 7,
  SEPT: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

function parseRevolutDate(raw: string): Date {
  const [dayStr, monthRaw, yearStr] = raw.trim().split(/\s+/);
  const month = monthRaw ? MONTHS[normalizeLetters(monthRaw)] : undefined;
  if (month === undefined || !dayStr || !yearStr) {
    throw new Error(`Invalid Revolut date: "${raw}"`);
  }
  return new Date(Date.UTC(Number(yearStr), month, Number(dayStr)));
}

function extractIban(lines: string[]): string | null {
  for (const line of lines) {
    const match = IBAN_RE.exec(line);
    if (match?.[1]) return match[1];
  }
  return null;
}

function buildAccountNumber(iban: string | null, label: string): string {
  const slug = normalizeLetters(label).toLowerCase() || 'compte';
  return iban ? `revolut-${iban.slice(-8).toLowerCase()}-${slug}` : `revolut-${slug}`;
}

// Revolut's own vault/pocket product ("Dépôt") is a savings feature, unlike
// Caisse d'Épargne's "compte de dépôt" wording for an everyday checking
// account — the same word means different things per bank, which is why this
// heuristic lives per-parser rather than as one shared keyword list.
function inferTargetType(label: string): PdfImportSuggestedTargetType {
  const letters = normalizeLetters(label);
  if (letters.includes('DEPOT') || letters.includes('EPARGNE') || letters.includes('VAULT')) {
    return 'savings_goal';
  }
  if (
    letters.includes('INVEST') ||
    letters.includes('ACTIONS') ||
    letters.includes('CRYPTO') ||
    letters.includes('TRADING')
  ) {
    return 'investment_account';
  }
  return 'account';
}

/** Parses a Revolut "Relevé" PDF — one product per row of its "Résumé du
 * solde" summary table (typically "Compte" and, if used, "Dépôt"/"Investir"),
 * each with its own "Transactions ..." detail section further down. Product
 * sections are paired to their detail section positionally, in the same
 * order the summary table lists them, since detail section headings don't
 * repeat the exact product label ("Transactions du compte" vs "Compte
 * (Compte courant)"). */
export function parseRevolutPdfStatement(lines: string[]): PdfStatementSection[] {
  const summaryStart = lines.indexOf(SUMMARY_MARKER);
  if (summaryStart === -1) {
    throw new AppError(
      400,
      'UNKNOWN_PDF_FORMAT',
      'Could not detect a supported bank statement format in this PDF',
    );
  }

  const products: { label: string; openingCents: number; closingCents: number }[] = [];
  for (let i = summaryStart + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith(SECTION_HEADER_PREFIX)) break;

    const match = SUMMARY_ROW_RE.exec(line);
    if (!match?.[1] || !match[2] || !match[3]) continue;
    const label = match[1].trim();
    if (label.toUpperCase() === 'TOTAL') continue;

    products.push({
      label,
      openingCents: parseAmountToCents(match[2], ','),
      closingCents: parseAmountToCents(match[3], ','),
    });
  }

  if (products.length === 0) {
    throw new AppError(
      400,
      'UNKNOWN_PDF_FORMAT',
      'Could not detect a supported bank statement format in this PDF',
    );
  }

  const iban = extractIban(lines);
  const sections: PdfStatementSection[] = [];
  let productIndex = -1;
  let current: PdfStatementSection | null = null;
  let runningBalanceCents = 0;

  for (let i = summaryStart; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.startsWith(SECTION_HEADER_PREFIX)) {
      productIndex++;
      const product = products[productIndex];
      if (!product) break; // more detail sections than known products — stop rather than guess
      current = {
        accountLabel: product.label,
        accountNumber: buildAccountNumber(iban, product.label),
        transactions: [],
        startingBalanceCents: product.openingCents,
        endingBalanceCents: product.closingCents,
        suggestedTargetType: inferTargetType(product.label),
      };
      sections.push(current);
      runningBalanceCents = product.openingCents;
      continue;
    }

    if (!current) continue;

    const match = TRANSACTION_ROW_RE.exec(line);
    if (!match?.[1] || !match[2] || !match[3]) continue;

    const date = parseRevolutDate(match[1]);
    const soldeAfterCents = parseAmountToCents(match[3], ',');
    const amountCents = soldeAfterCents - runningBalanceCents;
    runningBalanceCents = soldeAfterCents;

    current.transactions.push(toTransaction(date, amountCents, match[2].trim()));
  }

  for (const section of sections) {
    section.transactions = disambiguateDuplicates(section.transactions);
  }

  return sections;
}
