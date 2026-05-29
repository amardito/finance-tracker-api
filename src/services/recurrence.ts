import { addDays, addMonths, addWeeks, addYears } from 'date-fns';
import { Cadence } from '@prisma/client';

export function advance(date: Date, cadence: Cadence, interval: number): Date {
  switch (cadence) {
    case 'DAILY':
      return addDays(date, interval);
    case 'WEEKLY':
      return addWeeks(date, interval);
    case 'MONTHLY':
      return addMonths(date, interval);
    case 'YEARLY':
      return addYears(date, interval);
  }
}
