import pino from 'pino';
import { createRequire } from 'node:module';
import { config, isProd } from './config.js';

const req = createRequire(import.meta.url);

function tryLoadPretty(): pino.TransportSingleOptions | undefined {
  if (isProd || config.NODE_ENV === 'test') return undefined;
  try {
    req.resolve('pino-pretty');
    return { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } };
  } catch {
    return undefined;
  }
}

export const logger = pino({
  level: config.LOG_LEVEL,
  transport: tryLoadPretty(),
});
