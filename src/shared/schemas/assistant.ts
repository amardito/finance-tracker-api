import { z } from 'zod';
import {
  ASSISTANT_ACTION_TYPES,
  ASSISTANT_PROPOSAL_SOURCES,
  ASSISTANT_PROPOSAL_STATUSES,
  ASSISTANT_RISK_LEVELS,
  CLAW_MODES,
  TRANSACTION_TYPES,
} from '../enums.js';
import { dateStringSchema, moneySchema } from './common.js';

export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

export const assistantTransactionPayloadSchema = z.object({
  accountId: z.string(),
  categoryId: z.string(),
  amount: moneySchema,
  type: z.enum(TRANSACTION_TYPES),
  date: dateStringSchema,
  note: z.string().max(500).optional(),
  tagIds: z.array(z.string()).optional(),
});

export const assistantProposalCreateSchema = z.object({
  actionType: z.enum(ASSISTANT_ACTION_TYPES),
  sourceChannel: z.enum(ASSISTANT_PROPOSAL_SOURCES),
  clawMode: z.enum(CLAW_MODES).default('NONE'),
  riskLevel: z.enum(ASSISTANT_RISK_LEVELS),
  confidence: z.record(jsonValueSchema).optional(),
  payload: z.record(jsonValueSchema),
  summary: z.string().min(1).max(1000),
  expiresAt: dateStringSchema.optional(),
});

export const assistantProposalFiltersSchema = z.object({
  status: z.enum(ASSISTANT_PROPOSAL_STATUSES).optional(),
  sourceChannel: z.enum(ASSISTANT_PROPOSAL_SOURCES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const assistantAuditActions = [
  'proposal.create',
  'proposal.approve',
  'proposal.reject',
  'proposal.execute',
  'proposal.edit',
  'proposal.undo',
  'proposal.fail',
  'proposal.expire',
] as const;

export const assistantAuditFiltersSchema = z.object({
  proposalId: z.string().optional(),
  action: z.enum(assistantAuditActions).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AssistantProposalCreateInput = z.infer<typeof assistantProposalCreateSchema>;
export type AssistantProposalFilters = z.infer<typeof assistantProposalFiltersSchema>;
export type AssistantAuditFilters = z.infer<typeof assistantAuditFiltersSchema>;
