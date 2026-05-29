import { describe, it, expect } from 'vitest';
import { parseImportRow } from '../src/services/csv-import.js';

describe('parseImportRow', () => {
  const mapping = { date: 0, amount: 1, note: 2 };

  it('parses a valid sign_based expense row', () => {
    const r = parseImportRow(['2024-03-15', '42.50', 'Coffee'], mapping, 'sign_based');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.type).toBe('EXPENSE');
      expect(r.amount).toBe('42.50');
      expect(r.note).toBe('Coffee');
      expect(r.date.toISOString().slice(0, 10)).toBe('2024-03-15');
    }
  });

  it('parses sign_based income (negative number)', () => {
    const r = parseImportRow(['2024-03-15', '-1500.00', 'Salary'], mapping, 'sign_based');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.type).toBe('INCOME');
      expect(r.amount).toBe('1500.00');
    }
  });

  it('parses positive_income convention', () => {
    const r = parseImportRow(['2024-03-15', '1500.00', 'Pay'], mapping, 'positive_income');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.type).toBe('INCOME');
      expect(r.amount).toBe('1500.00');
    }
  });

  it('strips currency symbols from amount', () => {
    const r = parseImportRow(['2024-03-15', '$1,234.56', ''], mapping, 'positive_income');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount).toBe('1234.56');
  });

  it('rejects missing date or amount', () => {
    expect(parseImportRow(['', '10', ''], mapping, 'sign_based').ok).toBe(false);
    expect(parseImportRow(['2024-01-01', '', ''], mapping, 'sign_based').ok).toBe(false);
  });

  it('rejects invalid date', () => {
    const r = parseImportRow(['not-a-date', '10', ''], mapping, 'sign_based');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/date/i);
  });

  it('rejects non-numeric amount', () => {
    const r = parseImportRow(['2024-01-01', 'abc', ''], mapping, 'sign_based');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/amount/i);
  });

  it('explicit type column overrides sign inference', () => {
    const r = parseImportRow(
      ['2024-03-15', '50', 'note', 'INCOME'],
      { date: 0, amount: 1, note: 2, type: 3 },
      'sign_based',
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.type).toBe('INCOME');
  });

  it('truncates very long notes to 500 chars', () => {
    const longNote = 'x'.repeat(800);
    const r = parseImportRow(['2024-01-01', '10', longNote], mapping, 'sign_based');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.note?.length).toBe(500);
  });

  it('rounds amount to 2 decimal places', () => {
    const r = parseImportRow(['2024-01-01', '10.999', ''], mapping, 'sign_based');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount).toBe('11.00');
  });
});
