import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { csrfProtect } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { accountsRouter } from './routes/accounts.js';
import { categoriesRouter } from './routes/categories.js';
import { tagsRouter } from './routes/tags.js';
import { transactionsRouter } from './routes/transactions.js';
import { budgetsRouter } from './routes/budgets.js';
import { recurringRouter } from './routes/recurring.js';
import { goalsRouter } from './routes/goals.js';
import { reportsRouter } from './routes/reports.js';
import { importRouter } from './routes/import.js';
import { startRecurringCron } from './jobs/recurring.js';
import { prisma } from './lib/prisma.js';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false, // SPA served separately
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: config.WEB_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          req.url === '/api/health' || req.url === '/api/ready',
      },
    }),
  );
  app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true }));

  // Liveness — process is up
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Readiness — DB reachable
  app.get('/api/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not-ready' });
    }
  });

  // CSRF protection on all /api/* (auth router gets its own GET pass)
  app.use('/api', csrfProtect);

  app.use('/api/auth', authRouter);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/budgets', budgetsRouter);
  app.use('/api/recurring', recurringRouter);
  app.use('/api/goals', goalsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/import', importRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function main(): Promise<void> {
  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'API listening');
  });

  if (config.RECURRING_CRON_ENABLED) {
    startRecurringCron();
  } else {
    logger.info('Recurring cron disabled by config');
  }

  let shuttingDown = false;
  const shutdown = async (sig: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ sig }, 'Shutting down');
    server.close(() => logger.info('HTTP server closed'));
    setTimeout(() => {
      logger.warn('Forcing exit after 10s');
      process.exit(1);
    }, 10_000).unref();
    try {
      await prisma.$disconnect();
    } catch (err) {
      logger.error({ err }, 'Error during prisma disconnect');
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'uncaughtException');
  });
}

if (process.env.NODE_ENV !== 'test') {
  void main();
}
