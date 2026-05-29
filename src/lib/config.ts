import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  SESSION_COOKIE_NAME: z.string().default('ft_session'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DEFAULT_CURRENCY: z.string().length(3).default('USD'),
  SIGNUP_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  RECURRING_CRON_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.string().default('info'),
});

export const config = envSchema.parse(process.env);
export const isProd = config.NODE_ENV === 'production';
