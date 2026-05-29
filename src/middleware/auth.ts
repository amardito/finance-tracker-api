import { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { getSession } from '../lib/session.js';
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
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
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
