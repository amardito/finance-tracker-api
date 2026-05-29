import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { Request, Response } from 'express';
import { config, isProd } from './config.js';

export interface SessionData {
  userId?: string;
  csrf?: string;
}

// Cookie attributes can be overridden via COOKIE_SAMESITE and COOKIE_SECURE env vars.
// Defaults: sameSite=lax, secure=isProd. Cross-site cookies require sameSite=none + secure=true.
export const cookieSameSite: 'lax' | 'strict' | 'none' = config.COOKIE_SAMESITE ?? 'lax';
export const cookieSecure: boolean =
  config.COOKIE_SECURE !== undefined ? config.COOKIE_SECURE : isProd;

export const sessionOptions: SessionOptions = {
  password: config.SESSION_SECRET,
  cookieName: config.SESSION_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    sameSite: cookieSameSite,
    secure: cookieSecure,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  },
};

const sessionCache = new WeakMap<Request, IronSession<SessionData>>();

export async function getSession(req: Request, res: Response): Promise<IronSession<SessionData>> {
  const existing = sessionCache.get(req);
  if (existing) return existing;
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  sessionCache.set(req, session);
  return session;
}
