import { z } from 'zod';
import { BUDGET_PERIODS } from '../enums.js';
import { dateStringSchema, moneySchema } from './common.js';

export const budgetCreateSchema = z.object({
  categoryId: z.string(),
  amount: moneySchema,
  period: z.enum(BUDGET_PERIODS),
  startDate: dateStringSchema,
  rollover: z.boolean().default(false),
});

export const budgetUpdateSchema = budgetCreateSchema.partial();

export type BudgetCreateInput = z.infer<typeof budgetCreateSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;
