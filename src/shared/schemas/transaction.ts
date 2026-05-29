import { z } from 'zod';
import { TRANSACTION_TYPES } from '../enums.js';
import { dateStringSchema, moneySchema } from './common.js';

export const transactionCreateSchema = z.object({
  accountId: z.string(),
  categoryId: z.string(),
  amount: moneySchema,
  type: z.enum(TRANSACTION_TYPES),
  date: dateStringSchema,
  note: z.string().max(500).optional(),
  tagIds: z.array(z.string()).optional(),
});

export const transactionUpdateSchema = transactionCreateSchema.partial();

export const transactionFiltersSchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  tagId: z.string().optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const bulkTransactionSchema = z.object({
  transactions: z.array(transactionCreateSchema).min(1).max(5000),
});

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
