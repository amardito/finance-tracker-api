import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { Request, Response } from 'express';
import { config, isProd } from './config.js';

export interface SessionData {
  userId?: string;
  csrf?: string;
}

export const sessionOptions: SessionOptions = {
  password: config.SESSION_SECRET,
  cookieName: config.SESSION_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  },
};

export async function getSession(req: Request, res: Response): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(req, res, sessionOptions);
}
