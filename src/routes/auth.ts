import { Router, type Router as RouterT } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getSession } from '../lib/session.js';
import { config } from '../lib/config.js';
import { HttpError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { defaultCategories } from '../services/defaults.js';

export const authRouter: RouterT = Router();

const limiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true });

const TOKEN_PREFIX = 'ft_';
const TOKEN_BYTES = 32; // 64 hex chars after prefix

function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const tokenLoginSchema = z.object({
  token: z.string().min(8).max(200),
});

const newTokenSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

// Create a new anonymous user; returns the raw token ONCE.
authRouter.post('/token/new', limiter, validateBody(newTokenSchema), async (req, res, next) => {
  try {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const user = await prisma.user.create({
      data: {
        name: (req.body.name as string | undefined) || 'Anonymous',
        currency: config.DEFAULT_CURRENCY,
        tokenHash,
      },
    });
    await prisma.category.createMany({
      data: defaultCategories.map((c) => ({ ...c, userId: user.id })),
    });
    const session = await getSession(req, res);
    session.userId = user.id;
    await session.save();
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        currency: user.currency,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Login by existing token.
authRouter.post('/token/login', limiter, validateBody(tokenLoginSchema), async (req, res, next) => {
  try {
    const token = (req.body.token as string).trim();
    const tokenHash = hashToken(token);
    const user = await prisma.user.findUnique({ where: { tokenHash } });
    if (!user) throw new HttpError(401, 'INVALID_TOKEN', 'Token not recognized');
    const session = await getSession(req, res);
    session.userId = user.id;
    await session.save();
    res.json({
      id: user.id,
      name: user.name,
      currency: user.currency,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const session = await getSession(req, res);
    session.destroy();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Not signed in');
    res.json({
      id: user.id,
      name: user.name,
      currency: user.currency,
      createdAt: user.createdAt.toISOString(),
      hasToken: !!user.tokenHash,
    });
  } catch (err) {
    next(err);
  }
});

// Rotate token (revokes old one, returns new one once)
authRouter.post('/token/rotate', requireAuth, limiter, async (req, res, next) => {
  try {
    const token = generateToken();
    const tokenHash = hashToken(token);
    await prisma.user.update({
      where: { id: req.userId! },
      data: { tokenHash },
    });
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

// Update profile (name, currency)
const profileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  currency: z.string().length(3).optional(),
});

authRouter.patch('/me', requireAuth, validateBody(profileSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: req.body,
    });
    res.json({
      id: user.id,
      name: user.name,
      currency: user.currency,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
