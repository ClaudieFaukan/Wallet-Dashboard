import { AppError } from '../../shared/utils/AppError.js';
import { parseAmountToCents } from '../csv/amount.js';
import { parseDate } from '../csv/date.js';
import { disambiguateDuplicates, toTransaction } from '../shared/transaction.js';
import { normalizeLetters } from './label.js';
import type { PdfImportSuggestedTargetType, PdfStatementSection } from './pdf-statement.js';

export type { PdfStatementSection };

const SECTION_START_MARKER = 'DETAIL DE VOS OPERATIONS';

// e.g. "COMPTE DE DEPOT - N° 04093455065", "L.E.P. EN CPTE - N° 05234087765"
const SECTION_HEADER_RE = /^([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9.' ]*?)\s*-\s*N°\s*([\d ]+)$/;

// e.g. "16/06/2026 16/06/2026 * COTIS BOUQUET LIBERTE - 11,45"
// e.g. "01/07/2026 01/07/2026 VIR SEPA FRANCE TRAVAIL NORMAND + 1 424,40"
const TRANSACTION_ROW_RE =
  /^(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+(.+?)\s+([+-]\s?[\d ]+,\d{2})$/;

// e.g. "SOLDE DEBITEUR AU 13/06/2026 - 435,40", "SOLDE CREDITEUR AU 13/07/2026 + 14,90"
// — a running-balance line printed before the first and after the last transaction of
// each section, never a movement itself.
const BALANCE_ROW_RE = /^SOLDE (?:DEBITEUR|CREDITEUR) AU \d{2}\/\d{2}\/\d{4}\s+([+-]\s?[\d ]+,\d{2})$/;

// Statement account numbers appear both in short form ("04093455065") and
// prefixed with agency/guichet codes ("11425 00900 04093455065") depending on
// which part of the document they're printed in — the true account number is
// always the last 11 digits.
function canonicalAccountNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length > 11 ? digits.slice(-11) : digits;
}

// A livret (LEP, Livret A...) is fundamentally a savings goal, and a PEA/
// brokerage cash pocket belongs with investment tracking — only a plain
// "compte de dépôt" (checking) or livret courant maps to a bare bank account.
function inferTargetType(label: string): PdfImportSuggestedTargetType {
  const letters = normalizeLetters(label);
  if (letters.includes('PEA') || letters.includes('INVEST') || letters.includes('TITRE')) {
    return 'investment_account';
  }
  if (letters.includes('LEP') || letters.includes('LIVRET') || letters.includes('EPARGNE')) {
    return 'savings_goal';
  }
  return 'account';
}

/** Parses a Caisse d'Épargne "relevé de comptes" PDF (possibly bundling
 * several accounts — checking, livret, PEA cash — into one document) into
 * one section per account, each with its own transactions. */
export function parseCaisseEpargnePdfStatement(lines: string[]): PdfStatementSection[] {
  const sections: PdfStatementSection[] = [];
  let current: PdfStatementSection | null = null;
  let inDetailSection = false;

  for (const line of lines) {
    if (!inDetailSection) {
      if (line === SECTION_START_MARKER) inDetailSection = true;
      continue;
    }

    const headerMatch = SECTION_HEADER_RE.exec(line);
    if (headerMatch?.[1] && headerMatch[2]) {
      const accountLabel = headerMatch[1].trim();
      current = {
        accountLabel,
        accountNumber: canonicalAccountNumber(headerMatch[2]),
        transactions: [],
        startingBalanceCents: null,
        endingBalanceCents: null,
        suggestedTargetType: inferTargetType(accountLabel),
      };
      sections.push(current);
      continue;
    }

    if (!current) continue;

    const balanceMatch = BALANCE_ROW_RE.exec(line);
    if (balanceMatch?.[1]) {
      const balanceCents = parseAmountToCents(balanceMatch[1], ',');
      if (current.startingBalanceCents === null) current.startingBalanceCents = balanceCents;
      current.endingBalanceCents = balanceCents;
      continue;
    }

    const txMatch = TRANSACTION_ROW_RE.exec(line);
    if (!txMatch?.[1] || !txMatch[2] || !txMatch[3]) continue;

    const date = parseDate(txMatch[1]);
    const amountCents = parseAmountToCents(txMatch[3], ',');
    current.transactions.push(toTransaction(date, amountCents, txMatch[2].trim()));
  }

  if (sections.length === 0) {
    throw new AppError(
      400,
      'UNKNOWN_PDF_FORMAT',
      'Could not detect a supported bank statement format in this PDF',
    );
  }

  for (const section of sections) {
    section.transactions = disambiguateDuplicates(section.transactions);
  }

  return sections;
}
