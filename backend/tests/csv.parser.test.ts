import { describe, expect, it } from 'vitest';
import { parseCsv } from '../src/integrations/csv/csv.parser.js';

describe('parseCsv', () => {
  it('parses a Revolut export, skipping non-completed rows', () => {
    const csv = [
      'Date,Description,Amount,Fee,Currency,State,Balance',
      '2026-01-05,Carrefour Market,-45.90,0.00,EUR,COMPLETED,1000.00',
      '2026-01-06,Salary,2000.00,0.00,EUR,COMPLETED,3000.00',
      '2026-01-07,Pending payment,-10.00,0.00,EUR,PENDING,2990.00',
    ].join('\n');

    const { format, transactions } = parseCsv(csv);

    expect(format).toBe('revolut');
    expect(transactions).toHaveLength(2);
    expect(transactions[0]).toMatchObject({
      amountCents: -4590,
      description: 'Carrefour Market',
      type: 'expense',
    });
    expect(transactions[1]).toMatchObject({
      amountCents: 200000,
      description: 'Salary',
      type: 'income',
    });
  });

  it('parses a Trade Republic export', () => {
    const csv = [
      'Date,Valeur,Montant,ISIN,Nom',
      '2026-02-01,2026-02-03,-150.50,IE00B4L5Y983,iShares Core MSCI World',
    ].join('\n');

    const { format, transactions } = parseCsv(csv);

    expect(format).toBe('trade_republic');
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      amountCents: -15050,
      description: 'iShares Core MSCI World',
      type: 'expense',
    });
  });

  it('parses a BNC export with separate débit/crédit columns', () => {
    const csv = [
      'Date,Description,Débit,Crédit,Solde',
      '2026-03-10,Loyer,850.00,,1150.00',
      '2026-03-11,Virement reçu,,500.00,1650.00',
    ].join('\n');

    const { format, transactions } = parseCsv(csv);

    expect(format).toBe('bnc');
    expect(transactions).toHaveLength(2);
    expect(transactions[0]).toMatchObject({ amountCents: -85000, type: 'expense' });
    expect(transactions[1]).toMatchObject({ amountCents: 50000, type: 'income' });
  });

  it("parses a Caisse d'Épargne export (semicolon delimiter, comma decimal)", () => {
    const csv = [
      "Date de l'opération;Libellé;Débit;Crédit",
      '15/04/2026;Abonnement Internet;39,99;',
      '16/04/2026;Remboursement;;120,00',
    ].join('\n');

    const { format, transactions } = parseCsv(csv);

    expect(format).toBe('caisse_epargne');
    expect(transactions).toHaveLength(2);
    expect(transactions[0]).toMatchObject({ amountCents: -3999, type: 'expense' });
    expect(transactions[1]).toMatchObject({ amountCents: 12000, type: 'income' });
  });

  it('computes a stable, deduplicating externalId for identical rows', () => {
    const csv = [
      'Date,Description,Amount,Fee,Currency,State,Balance',
      '2026-01-05,Carrefour Market,-45.90,0.00,EUR,COMPLETED,1000.00',
    ].join('\n');

    const first = parseCsv(csv).transactions[0]!;
    const second = parseCsv(csv).transactions[0]!;
    expect(first.externalId).toBe(second.externalId);
    expect(first.externalId).toMatch(/^[a-f0-9]{64}$/);
  });

  it('throws on an unrecognized format', () => {
    const csv = 'Foo,Bar\n1,2';
    expect(() => parseCsv(csv)).toThrow(/Could not detect/);
  });
});
