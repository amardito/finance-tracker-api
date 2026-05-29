import { z } from 'zod';

export const idSchema = z.string().min(1);
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v.toFixed(2) : v))
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), 'Invalid money value');

export const dateStringSchema = z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string()).optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
