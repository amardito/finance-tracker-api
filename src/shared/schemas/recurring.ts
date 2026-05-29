import { z } from 'zod';
import { CADENCES, TRANSACTION_TYPES } from '../enums.js';
import { dateStringSchema, moneySchema } from './common.js';

export const recurringCreateSchema = z.object({
  accountId: z.string(),
  categoryId: z.string(),
  amount: moneySchema,
  type: z.enum(TRANSACTION_TYPES),
  cadence: z.enum(CADENCES),
  interval: z.number().int().min(1).max(365).default(1),
  note: z.string().max(500).optional(),
  startDate: dateStringSchema,
  endDate: dateStringSchema.optional(),
});

export const recurringUpdateSchema = recurringCreateSchema.partial().extend({
  paused: z.boolean().optional(),
});

export type RecurringCreateInput = z.infer<typeof recurringCreateSchema>;
export type RecurringUpdateInput = z.infer<typeof recurringUpdateSchema>;
