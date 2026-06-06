import { z } from 'zod';
import { ACCOUNT_TYPES } from '../enums.js';
import { moneySchema } from './common.js';

export const accountSetupPayloadSchema = z.object({
  accounts: z.array(z.object({
    name: z.string().min(1).max(100),
    type: z.enum(ACCOUNT_TYPES),
    openingBalance: moneySchema.default('0'),
    currency: z.string().default('USD'),
  })),
});
