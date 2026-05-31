import { z } from 'zod';
import { dateStringSchema, moneySchema } from '../shared/index.js';

export const aiFieldConfidenceSchema = z.object({
  value: z.number().min(0).max(1),
  reason: z.string().max(300).optional(),
});

export const aiParsedCashflowCommandSchema = z.object({
  intent: z.enum(['create_transaction', 'create_transfer', 'query', 'unknown']),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  amount: moneySchema.optional(),
  date: dateStringSchema.optional(),
  note: z.string().max(500).optional(),
  accountHint: z.string().max(120).optional(),
  categoryHint: z.string().max(120).optional(),
  tagHints: z.array(z.string().max(40)).default([]),
  missingFields: z.array(z.string()).default([]),
  confidence: z.record(aiFieldConfidenceSchema),
});

export const aiReceiptLineItemSchema = z.object({
  label: z.string(),
  quantity: z.number().optional(),
  unitPrice: moneySchema.optional(),
  total: moneySchema.optional(),
  confidence: z.record(aiFieldConfidenceSchema).default({}),
});

export const aiReceiptExtractionSchema = z.object({
  merchant: z.string().optional(),
  date: dateStringSchema.optional(),
  total: moneySchema.optional(),
  currency: z.string().length(3).optional(),
  paymentAccountHint: z.string().max(120).optional(),
  lineItems: z.array(aiReceiptLineItemSchema).default([]),
  ocrText: z.string().optional(),
  missingFields: z.array(z.string()).default([]),
  confidence: z.record(aiFieldConfidenceSchema),
});

export const aiContextFusionSchema = z.object({
  transactionCandidate: aiParsedCashflowCommandSchema.partial().extend({
    receipt: aiReceiptExtractionSchema.optional(),
  }),
  summary: z.string().max(1000),
  needsFollowUp: z.boolean(),
  followUpQuestion: z.string().max(500).optional(),
});

export const aiInsightSchema = z.object({
  title: z.string().max(120),
  summary: z.string().max(1200),
  facts: z.array(
    z.object({
      label: z.string().max(120),
      value: z.string().max(120),
      source: z.string().max(120),
    }),
  ),
  recommendations: z.array(z.string().max(300)).default([]),
  confidence: z.number().min(0).max(1),
});

export type AiParsedCashflowCommand = z.infer<typeof aiParsedCashflowCommandSchema>;
export type AiReceiptExtraction = z.infer<typeof aiReceiptExtractionSchema>;
export type AiContextFusion = z.infer<typeof aiContextFusionSchema>;
export type AiInsight = z.infer<typeof aiInsightSchema>;

export type AiHarnessInput<TContext = unknown> = {
  userId: string;
  language: 'id' | 'en';
  text?: string;
  imageRef?: string;
  context?: TContext;
};

export type AiHarnessResult<TOutput> = {
  output: TOutput;
  provider: string;
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
};

export interface AiHarness {
  parseCashflowText(input: AiHarnessInput): Promise<AiHarnessResult<AiParsedCashflowCommand>>;
  extractReceipt(input: AiHarnessInput): Promise<AiHarnessResult<AiReceiptExtraction>>;
  fuseReceiptContext(input: AiHarnessInput): Promise<AiHarnessResult<AiContextFusion>>;
  runWorkflow<TOutput>(name: string, input: AiHarnessInput): Promise<AiHarnessResult<TOutput>>;
  explainInsight(input: AiHarnessInput): Promise<AiHarnessResult<AiInsight>>;
}
