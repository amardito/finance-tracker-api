import { z } from 'zod';
import { ACCOUNT_TYPES } from '../enums.js';
import { moneySchema } from './common.js';

export const accountCreateSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(ACCOUNT_TYPES),
  openingBalance: moneySchema.default('0'),
  currency: z.string().length(3).optional(),
});

export const accountUpdateSchema = accountCreateSchema.partial().extend({
  archived: z.boolean().optional(),
});

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
