import { describe, it, expect } from 'vitest';
import { advance } from '../src/services/recurrence.js';

describe('recurrence.advance', () => {
  const base = new Date('2024-01-15T00:00:00Z');

  it('advances daily', () => {
    expect(advance(base, 'DAILY', 1).toISOString()).toBe('2024-01-16T00:00:00.000Z');
    expect(advance(base, 'DAILY', 7).toISOString()).toBe('2024-01-22T00:00:00.000Z');
  });

  it('advances weekly', () => {
    expect(advance(base, 'WEEKLY', 2).toISOString()).toBe('2024-01-29T00:00:00.000Z');
  });

  it('advances monthly', () => {
    expect(advance(base, 'MONTHLY', 1).toISOString()).toBe('2024-02-15T00:00:00.000Z');
  });

  it('advances yearly', () => {
    expect(advance(base, 'YEARLY', 1).toISOString()).toBe('2025-01-15T00:00:00.000Z');
  });

  it('handles month-end edge cases (Jan 31 -> Feb 29 in leap year)', () => {
    const jan31 = new Date('2024-01-31T00:00:00Z');
    const result = advance(jan31, 'MONTHLY', 1);
    // date-fns addMonths clamps to last day of month
    expect(result.toISOString().slice(0, 10)).toBe('2024-02-29');
  });

  it('handles leap day (Feb 29 -> Feb 28 next year)', () => {
    const feb29 = new Date('2024-02-29T00:00:00Z');
    const result = advance(feb29, 'YEARLY', 1);
    expect(result.toISOString().slice(0, 10)).toBe('2025-02-28');
  });

  it('multi-step advance produces correct sequence', () => {
    let d = base;
    const dates: string[] = [];
    for (let i = 0; i < 4; i++) {
      d = advance(d, 'MONTHLY', 1);
      dates.push(d.toISOString().slice(0, 10));
    }
    expect(dates).toEqual(['2024-02-15', '2024-03-15', '2024-04-15', '2024-05-15']);
  });
});
