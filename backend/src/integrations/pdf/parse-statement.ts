import { AppError } from '../../shared/utils/AppError.js';
import { parseCaisseEpargnePdfStatement } from './caisse-epargne-pdf.parser.js';
import type { PdfStatementSection } from './pdf-statement.js';
import { parseRevolutPdfStatement } from './revolut-pdf.parser.js';

const PARSERS = [parseCaisseEpargnePdfStatement, parseRevolutPdfStatement];

/** Tries each known bank statement parser in turn — every parser throws
 * `UNKNOWN_PDF_FORMAT` when it doesn't recognize its own marker, so the first
 * one that doesn't throw wins. Add a new bank by adding its parser here. */
export function parsePdfStatement(lines: string[]): PdfStatementSection[] {
  for (const parser of PARSERS) {
    try {
      return parser(lines);
    } catch {
      // not this format — try the next parser
    }
  }

  throw new AppError(
    400,
    'UNKNOWN_PDF_FORMAT',
    'Could not detect a supported bank statement format in this PDF',
  );
}
