import { z } from 'zod';
import { CATEGORY_TYPES } from '../enums.js';

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(CATEGORY_TYPES),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#6366f1'),
  icon: z.string().max(40).optional(),
  parentId: z.string().nullable().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
