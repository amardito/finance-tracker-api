import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';

describe('money math (Decimal)', () => {
  it('adds and subtracts without float drift', () => {
    const a = new Decimal('0.1').plus('0.2');
    expect(a.toString()).toBe('0.3');
    const b = new Decimal('100.05').minus('25.10');
    expect(b.toString()).toBe('74.95');
  });

  it('preserves 2 decimal places via toFixed', () => {
    const v = new Decimal('123.456').toFixed(2);
    expect(v).toBe('123.46');
  });

  it('handles negative amounts', () => {
    const v = new Decimal('-50').plus('30');
    expect(v.toString()).toBe('-20');
  });

  it('computes net = income - expense', () => {
    const income = new Decimal('1500.00');
    const expense = new Decimal('845.37');
    expect(income.minus(expense).toString()).toBe('654.63');
  });

  it('computes budget ratio safely with zero', () => {
    const spent = new Decimal('40');
    const limit = new Decimal('0');
    const ratio = limit.gt(0) ? spent.div(limit).toNumber() : 0;
    expect(ratio).toBe(0);
  });

  it('computes budget ratio with non-zero', () => {
    const ratio = new Decimal('80').div('100').toNumber();
    expect(ratio).toBe(0.8);
  });
});
