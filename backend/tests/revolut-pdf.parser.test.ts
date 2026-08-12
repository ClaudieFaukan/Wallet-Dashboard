import { describe, expect, it } from 'vitest';
import { parseRevolutPdfStatement } from '../src/integrations/pdf/revolut-pdf.parser.js';

// Fixture lines are the exact shape produced by `extractPdfLines` for a real
// Revolut "Relevé" PDF bundling a checking account ("Compte") and a savings
// vault ("Dépôt") — trimmed to the rows that drive the parser's behavior.
const STATEMENT_LINES = [
  '84 Place André Follain IBAN FR7628233000018687457231850',
  'Résumé du solde',
  "Solde de",
  "Produit Solde d'ouverture Argent sortant Argent entrant",
  'clôture',
  'Compte (Compte courant) 0,00€ 465,62€ 470,00€ 4,38€',
  'Dépôt 0,00€ 0,00€ 10,00€ 10,00€',
  'Total 0,00€ 465,62€ 480,00€ 14,38€',
  "Le solde figurant sur votre relevé peut différer du solde affiché.",
  'Transactions du compte : du 24 juillet 2026 au 12 août 2026',
  'Date Description Argent sortant Argent entrant Solde',
  '29 juil. 2026 Paiement envoyé par M PETREL PIERRE-ALAIN 450,00€ 450,00€',
  'Référence : VIR. DE M PETREL PIERRE-ALAIN',
  '29 juil. 2026 Frais de livraison de carte 7,99€ 442,01€',
  'Carte : 535456******4890',
  '29 juil. 2026 To Jean-Francois Tessier 400,64€ 31,37€',
  'Référence : Loyer Pierre-Alain Petrel 489',
  'Frais: 1,10€ 399,54€',
  '640,00 CAD',
  '4 août 2026 Amazon Prime 6,99€ 4,38€',
  'Transactions de dépôt de 24 juillet 2026 à 12 août 2026',
  'Date Description Argent sortant Argent entrant Solde',
  '29 juil. 2026 À EUR Compte d\'épargne 10,00€ 10,00€',
];

describe('parseRevolutPdfStatement', () => {
  it('splits a multi-product statement into one section per product', () => {
    const sections = parseRevolutPdfStatement(STATEMENT_LINES);
    expect(sections).toHaveLength(2);
    expect(sections.map((s) => s.accountLabel)).toEqual(['Compte (Compte courant)', 'Dépôt']);
  });

  it('reads starting/ending balances straight from the summary table, skipping the Total row', () => {
    const [checking, deposit] = parseRevolutPdfStatement(STATEMENT_LINES);
    expect(checking).toMatchObject({ startingBalanceCents: 0, endingBalanceCents: 438 });
    expect(deposit).toMatchObject({ startingBalanceCents: 0, endingBalanceCents: 1000 });
  });

  it('derives each transaction amount from the balance delta, ignoring continuation noise (Frais/CAD lines)', () => {
    const [checking] = parseRevolutPdfStatement(STATEMENT_LINES);
    expect(checking!.transactions).toHaveLength(4);
    expect(checking!.transactions.map((t) => t.amountCents)).toEqual([45000, -799, -41064, -2699]);
    expect(checking!.transactions[2]).toMatchObject({ description: 'To Jean-Francois Tessier' });
  });

  it('parses French-month-name dates including single-digit days', () => {
    const [checking] = parseRevolutPdfStatement(STATEMENT_LINES);
    expect(checking!.transactions[0]!.date.toISOString().slice(0, 10)).toBe('2026-07-29');
    expect(checking!.transactions[3]!.date.toISOString().slice(0, 10)).toBe('2026-08-04');
  });

  it('routes "Compte" to a bank account and "Dépôt" (Revolut\'s savings vault) to a savings goal', () => {
    const [checking, deposit] = parseRevolutPdfStatement(STATEMENT_LINES);
    expect(checking!.suggestedTargetType).toBe('account');
    expect(deposit!.suggestedTargetType).toBe('savings_goal');
  });

  it('builds a stable account number from the IBAN and product name', () => {
    const [checking, deposit] = parseRevolutPdfStatement(STATEMENT_LINES);
    expect(checking!.accountNumber).toBe('revolut-57231850-comptecomptecourant');
    expect(deposit!.accountNumber).toBe('revolut-57231850-depot');
  });

  it('throws when no recognizable summary table is found', () => {
    expect(() => parseRevolutPdfStatement(['some unrelated PDF text'])).toThrow(/Could not detect/);
  });
});
