import { NextFunction, Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cookieSameSite, cookieSecure, getSession } from '../lib/session.js';
import { config } from '../lib/config.js';
import { HttpError } from './error.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await getSession(req, res);
    if (!session.userId) throw new HttpError(401, 'UNAUTHENTICATED', 'Not signed in');
    req.userId = session.userId;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireServiceAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    if (!config.FINTRACK_SERVICE_TOKEN) {
      throw new HttpError(503, 'SERVICE_AUTH_NOT_CONFIGURED', 'Service authentication is not configured');
    }
    const auth = req.headers.authorization ?? '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
    const headerToken = req.headers['x-fintrack-service-token'];
    const token = compactSecret(bearer || (Array.isArray(headerToken) ? headerToken[0] : headerToken) || '');
    if (!constantTimeEquals(token, config.FINTRACK_SERVICE_TOKEN)) {
      throw new HttpError(401, 'SERVICE_UNAUTHENTICATED', 'Invalid service credentials');
    }
    next();
  } catch (err) {
    next(err);
  }
}

function compactSecret(value: string): string {
  return value.replace(/\s+/g, '');
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const CSRF_HEADER = 'x-xsrf-token';
const CSRF_COOKIE = 'XSRF-TOKEN';

export async function csrfProtect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Issue CSRF cookie for safe methods if absent or out of sync
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const session = await getSession(req, res);
      const cookieToken = req.cookies?.[CSRF_COOKIE];
      if (!cookieToken || !session.csrf || cookieToken !== session.csrf) {
        const token = randomBytes(24).toString('hex');
        session.csrf = token;
        await session.save();
        res.cookie(CSRF_COOKIE, token, {
          httpOnly: false,
          sameSite: cookieSameSite,
          secure: cookieSecure,
          path: '/',
        });
      }
      return next();
    }
    const headerToken = req.headers[CSRF_HEADER];
    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const session = await getSession(req, res);
    if (
      !headerToken ||
      !cookieToken ||
      headerToken !== cookieToken ||
      headerToken !== session.csrf
    ) {
      throw new HttpError(403, 'CSRF', 'Invalid CSRF token');
    }
    next();
  } catch (err) {
    next(err);
  }
}
