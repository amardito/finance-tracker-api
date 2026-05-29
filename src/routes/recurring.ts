import { Router, type Router as RouterT } from 'express';
import { recurringCreateSchema, recurringUpdateSchema } from '../shared/index.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { HttpError } from '../middleware/error.js';
import { runRecurringRule, runDueRecurring } from '../jobs/recurring.js';

export const recurringRouter: RouterT = Router();
recurringRouter.use(requireAuth);

recurringRouter.get('/', async (req, res, next) => {
  try {
    const rules = await prisma.recurringRule.findMany({
      where: { userId: req.userId! },
      include: { account: true, category: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      rules.map((r) => ({
        ...r,
        amount: r.amount.toString(),
        startDate: r.startDate.toISOString(),
        endDate: r.endDate?.toISOString() ?? null,
        nextRunAt: r.nextRunAt.toISOString(),
        lastRunAt: r.lastRunAt?.toISOString() ?? null,
        pausedAt: r.pausedAt?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

recurringRouter.post('/', validateBody(recurringCreateSchema), async (req, res, next) => {
  try {
    const rule = await prisma.recurringRule.create({
      data: {
        userId: req.userId!,
        accountId: req.body.accountId,
        categoryId: req.body.categoryId,
        amount: req.body.amount,
        type: req.body.type,
        cadence: req.body.cadence,
        interval: req.body.interval ?? 1,
        note: req.body.note,
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
        nextRunAt: new Date(req.body.startDate),
      },
    });
    res.status(201).json({ ...rule, amount: rule.amount.toString() });
  } catch (err) {
    next(err);
  }
});

recurringRouter.patch('/:id', validateBody(recurringUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.recurringRule.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Recurring rule not found');
    const { paused, ...rest } = req.body;
    const rule = await prisma.recurringRule.update({
      where: { id: existing.id },
      data: {
        ...rest,
        startDate: rest.startDate ? new Date(rest.startDate) : undefined,
        endDate: rest.endDate ? new Date(rest.endDate) : undefined,
        pausedAt: paused === true ? new Date() : paused === false ? null : undefined,
      },
    });
    res.json({ ...rule, amount: rule.amount.toString() });
  } catch (err) {
    next(err);
  }
});

recurringRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.recurringRule.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Recurring rule not found');
    await prisma.recurringRule.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

recurringRouter.post('/:id/run', async (req, res, next) => {
  try {
    const existing = await prisma.recurringRule.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Recurring rule not found');
    const created = await runRecurringRule(existing.id);
    res.json({ created });
  } catch (err) {
    next(err);
  }
});

recurringRouter.post('/run-due', async (_req, res, next) => {
  try {
    const total = await runDueRecurring();
    res.json({ created: total });
  } catch (err) {
    next(err);
  }
});

