import { z } from 'zod';

export const clawProviders = ['NANOBOT_WHATSAPP'] as const;

export const clawLinkCodeCreateSchema = z.object({
  ttlMinutes: z.coerce.number().int().min(1).max(60).default(10),
});

export const clawLinkCodeRedeemSchema = z.object({
  code: z.string().min(6).max(64),
  provider: z.enum(clawProviders).default('NANOBOT_WHATSAPP'),
  externalUserId: z.string().min(1).max(200),
  displayName: z.string().max(200).optional(),
});

export const clawTransactionProposalSchema = z.object({
  provider: z.enum(clawProviders).default('NANOBOT_WHATSAPP'),
  externalUserId: z.string().min(1).max(200),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  type: z.enum(['INCOME', 'EXPENSE']),
  date: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
  tagIds: z.array(z.string().min(1)).optional(),
  sourceText: z.string().max(1000).optional(),
  confidence: z.number().min(0).max(1).default(0.8),
});

export const clawCommandIngressSchema = z.object({
  provider: z.enum(clawProviders).default('NANOBOT_WHATSAPP'),
  externalUserId: z.string().min(1).max(200),
  text: z.string().min(1).max(1000),
  messageId: z.string().max(200).optional(),
});

export type ClawLinkCodeCreateInput = z.infer<typeof clawLinkCodeCreateSchema>;
export type ClawLinkCodeRedeemInput = z.infer<typeof clawLinkCodeRedeemSchema>;
export type ClawTransactionProposalInput = z.infer<typeof clawTransactionProposalSchema>;
export type ClawCommandIngressInput = z.infer<typeof clawCommandIngressSchema>;
