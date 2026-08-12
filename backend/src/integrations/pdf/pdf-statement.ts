import type { ParsedTransaction } from '../shared/transaction.js';

/** Which app domain module a statement section most likely belongs to —
 * computed by each bank-specific parser from its own product naming
 * conventions, since the same keyword can mean different things across banks
 * (e.g. Revolut's "Dépôt" is a savings vault, but Caisse d'Épargne's "Compte
 * de dépôt" is the everyday checking account). */
export type PdfImportSuggestedTargetType = 'account' | 'savings_goal' | 'investment_account';

export interface PdfStatementSection {
  accountLabel: string;
  accountNumber: string;
  transactions: ParsedTransaction[];
  /** Declared balance right before the first transaction, in cents — null if
   * the statement never printed one for this section. */
  startingBalanceCents: number | null;
  /** Declared balance after the last transaction, in cents. */
  endingBalanceCents: number | null;
  suggestedTargetType: PdfImportSuggestedTargetType;
}
