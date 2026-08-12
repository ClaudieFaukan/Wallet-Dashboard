import { describe, expect, it } from 'vitest';
import { parseCaisseEpargnePdfStatement } from '../src/integrations/pdf/caisse-epargne-pdf.parser.js';

// Fixture lines are the exact shape produced by `extractPdfLines` (one
// reconstructed row per line, in reading order) for a real Caisse d'Épargne
// "relevé de comptes" bundling a checking account, a livret and a PEA cash
// account — trimmed to the rows that drive the parser's behavior.
const STATEMENT_LINES = [
  'SYNTHESE DE VOS COMPTES',
  'COMPTE DE DEPOT N° 11425 00900 04093455065 Solde au 13/07/2026 - 565,75',
  'DETAIL DE VOS OPERATIONS',
  'COMPTE DE DEPOT - N° 04093455065',
  "DATE D'OPERATION DATE DE VALEUR DETAIL DES OPERATIONS MONTANT EN EUR",
  'SOLDE DEBITEUR AU 13/06/2026 - 435,40',
  '16/06/2026 16/06/2026 * COTIS BOUQUET LIBERTE - 11,45',
  '01/07/2026 01/07/2026 VIR SEPA FRANCE TRAVAIL NORMAND + 1 424,40',
  "-Réf. donneur d'ordre : 26179251074",
  '04/07/2026 04/07/2026 CB IMMIGRATION CAN FACT 160626 (EN CAD 184,75) - 114,21',
  'SOLDE DEBITEUR AU 13/07/2026 - 565,75',
  'L.E.P. EN CPTE - N° 05234087765',
  "DATE D'OPERATION DATE DE VALEUR DETAIL DES OPERATIONS MONTANT EN EUR",
  'SOLDE CREDITEUR AU 13/04/2026 + 164,90',
  '05/05/2026 16/05/2026 VIR SEPA M PETREL PIERRE-ALAIN + 150,00',
  'SOLDE CREDITEUR AU 13/07/2026 + 14,90',
  'NUMERAIRE PEA - N° 21124172269',
  'SOLDE CREDITEUR AU 13/06/2026 + 55,18',
  '25/06/2026 25/06/2026 INTERET PSO SLE DIEPPE BRAY BRES + 0,41',
  'SOLDE CREDITEUR AU 13/07/2026 + 55,59',
];

describe('parseCaisseEpargnePdfStatement', () => {
  it('splits a multi-account statement into one section per account', () => {
    const sections = parseCaisseEpargnePdfStatement(STATEMENT_LINES);

    expect(sections).toHaveLength(3);
    expect(sections.map((s) => s.accountNumber)).toEqual([
      '04093455065',
      '05234087765',
      '21124172269',
    ]);
    expect(sections.map((s) => s.accountLabel)).toEqual([
      'COMPTE DE DEPOT',
      'L.E.P. EN CPTE',
      'NUMERAIRE PEA',
    ]);
  });

  it('ignores rows before "DETAIL DE VOS OPERATIONS" and SOLDE balance markers', () => {
    const [checking] = parseCaisseEpargnePdfStatement(STATEMENT_LINES);
    expect(checking!.transactions).toHaveLength(3);
  });

  it('parses signed French amounts, including thousands-space grouping', () => {
    const [checking] = parseCaisseEpargnePdfStatement(STATEMENT_LINES);
    expect(checking!.transactions[0]).toMatchObject({
      amountCents: -1145,
      description: '* COTIS BOUQUET LIBERTE',
      type: 'expense',
    });
    expect(checking!.transactions[1]).toMatchObject({
      amountCents: 142440,
      description: 'VIR SEPA FRANCE TRAVAIL NORMAND',
      type: 'income',
    });
  });

  it('keeps a trailing parenthetical amount in the description without confusing it for the real amount', () => {
    const [checking] = parseCaisseEpargnePdfStatement(STATEMENT_LINES);
    expect(checking!.transactions[2]).toMatchObject({
      amountCents: -11421,
      description: 'CB IMMIGRATION CAN FACT 160626 (EN CAD 184,75)',
    });
  });

  it('uses the last 11 digits of the account number regardless of prefix form', () => {
    const sections = parseCaisseEpargnePdfStatement(STATEMENT_LINES);
    expect(sections[1]!.accountNumber).toBe('05234087765');
    expect(sections[2]!.accountNumber).toBe('21124172269');
  });

  it('captures the starting and ending declared balance per section', () => {
    const sections = parseCaisseEpargnePdfStatement(STATEMENT_LINES);
    expect(sections[0]).toMatchObject({ startingBalanceCents: -43540, endingBalanceCents: -56575 });
    expect(sections[1]).toMatchObject({ startingBalanceCents: 16490, endingBalanceCents: 1490 });
    expect(sections[2]).toMatchObject({ startingBalanceCents: 5518, endingBalanceCents: 5559 });
  });

  it('throws when no recognizable section is found', () => {
    expect(() => parseCaisseEpargnePdfStatement(['some unrelated PDF text'])).toThrow(
      /Could not detect/,
    );
  });

  it('assigns distinct external ids to two genuinely separate transactions that share the same date, amount and description', () => {
    const lines = [
      'DETAIL DE VOS OPERATIONS',
      'COMPTE DE DEPOT - N° 04093455065',
      '04/07/2026 04/07/2026 CB BABA YAGA FACT 170626 - 13,00',
      '04/07/2026 04/07/2026 CB BABA YAGA FACT 170626 - 13,00',
    ];

    const [section] = parseCaisseEpargnePdfStatement(lines);

    expect(section!.transactions).toHaveLength(2);
    const [first, second] = section!.transactions;
    expect(first!.externalId).not.toBe(second!.externalId);
    expect(first).toMatchObject({ amountCents: -1300, description: 'CB BABA YAGA FACT 170626' });
    expect(second).toMatchObject({ amountCents: -1300, description: 'CB BABA YAGA FACT 170626' });
  });
});
