import { z } from 'zod';
import { dateStringSchema } from './common.js';

export const reportRangeSchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export type ReportRange = z.infer<typeof reportRangeSchema>;
