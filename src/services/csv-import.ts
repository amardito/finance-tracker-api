export type AmountSign = 'positive_income' | 'sign_based';

export interface RowMapping {
  date: number;
  amount: number;
  note?: number;
  type?: number;
}

export interface ParsedRow {
  ok: true;
  date: Date;
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  note?: string;
}

export interface ParsedRowError {
  ok: false;
  reason: string;
}

export function parseImportRow(
  row: string[],
  mapping: RowMapping,
  amountSign: AmountSign,
): ParsedRow | ParsedRowError {
  const dateStr = row[mapping.date];
  const amountStr = row[mapping.amount];
  if (!dateStr || !amountStr) {
    return { ok: false, reason: 'Missing date or amount' };
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { ok: false, reason: 'Invalid date' };
  }
  const cleaned = amountStr.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') {
    return { ok: false, reason: 'Invalid amount' };
  }
  const num = Number(cleaned);
  if (isNaN(num)) {
    return { ok: false, reason: 'Invalid amount' };
  }
  let type: 'INCOME' | 'EXPENSE';
  let amount: number;
  if (amountSign === 'positive_income') {
    type = num >= 0 ? 'INCOME' : 'EXPENSE';
    amount = Math.abs(num);
  } else {
    // sign_based: positive = expense, negative = income (bank statement convention)
    type = num >= 0 ? 'EXPENSE' : 'INCOME';
    amount = Math.abs(num);
  }
  if (mapping.type !== undefined) {
    const t = row[mapping.type]?.toUpperCase();
    if (t === 'INCOME' || t === 'EXPENSE') type = t;
  }
  const note = mapping.note !== undefined ? row[mapping.note] : undefined;
  return {
    ok: true,
    date,
    amount: amount.toFixed(2),
    type,
    note: note?.slice(0, 500),
  };
}
