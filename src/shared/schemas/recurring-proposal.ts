import { z } from 'zod';
import { CADENCES, TRANSACTION_TYPES } from '../enums.js';
import { moneySchema, dateStringSchema } from './common.js';

export const recurringRuleProposalPayloadSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  amount: moneySchema,
  type: z.enum(TRANSACTION_TYPES),
  cadence: z.enum(CADENCES),
  interval: z.number().int().min(1).default(1),
  startDate: dateStringSchema,
  note: z.string().max(500).optional(),
});
