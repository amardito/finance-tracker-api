import { z } from 'zod';
import { dateStringSchema, moneySchema } from './common.js';

export const goalCreateSchema = z.object({
  name: z.string().min(1).max(80),
  targetAmount: moneySchema,
  deadline: dateStringSchema.optional(),
  accountId: z.string().optional(),
});

export const goalUpdateSchema = goalCreateSchema.partial().extend({
  status: z.enum(['ACTIVE', 'DONE', 'ARCHIVED']).optional(),
});

export const goalContributeSchema = z.object({
  amount: moneySchema,
  date: dateStringSchema.optional(),
  note: z.string().max(500).optional(),
});

export type GoalCreateInput = z.infer<typeof goalCreateSchema>;
export type GoalUpdateInput = z.infer<typeof goalUpdateSchema>;
export type GoalContributeInput = z.infer<typeof goalContributeSchema>;
