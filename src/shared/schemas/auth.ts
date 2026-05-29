import { z } from 'zod';

export const tokenLoginSchema = z.object({
  token: z.string().min(8).max(200),
});

export const newTokenSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency: z.string().length(3),
  createdAt: z.string(),
});

export type TokenLoginInput = z.infer<typeof tokenLoginSchema>;
export type NewTokenInput = z.infer<typeof newTokenSchema>;
export type User = z.infer<typeof userSchema>;
