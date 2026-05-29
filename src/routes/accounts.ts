import { Router, type Router as RouterT } from 'express';
import { accountCreateSchema, accountUpdateSchema } from '../shared/index.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { HttpError } from '../middleware/error.js';
import { config } from '../lib/config.js';
import { computeAccountBalance } from '../services/balances.js';

export const accountsRouter: RouterT = Router();
accountsRouter.use(requireAuth);

accountsRouter.get('/', async (req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'asc' },
    });
    const withBalances = await Promise.all(
      accounts.map(async (a) => ({
        ...a,
        openingBalance: a.openingBalance.toString(),
        balance: (await computeAccountBalance(req.userId!, a.id)).toString(),
      })),
    );
    res.json(withBalances);
  } catch (err) {
    next(err);
  }
});

accountsRouter.post('/', validateBody(accountCreateSchema), async (req, res, next) => {
  try {
    const { name, type, openingBalance, currency } = req.body;
    const acc = await prisma.account.create({
      data: {
        userId: req.userId!,
        name,
        type,
        openingBalance: openingBalance ?? '0',
        currency: currency ?? config.DEFAULT_CURRENCY,
      },
    });
    res.status(201).json({ ...acc, openingBalance: acc.openingBalance.toString() });
  } catch (err) {
    next(err);
  }
});

accountsRouter.patch('/:id', validateBody(accountUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Account not found');
    const { archived, ...rest } = req.body;
    const acc = await prisma.account.update({
      where: { id: existing.id },
      data: { ...rest, archivedAt: archived ? new Date() : archived === false ? null : undefined },
    });
    res.json({ ...acc, openingBalance: acc.openingBalance.toString() });
  } catch (err) {
    next(err);
  }
});

accountsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Account not found');
    const txCount = await prisma.transaction.count({ where: { accountId: existing.id } });
    if (txCount > 0) {
      throw new HttpError(
        409,
        'HAS_TRANSACTIONS',
        'Cannot delete account with transactions; archive it instead',
      );
    }
    await prisma.account.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

