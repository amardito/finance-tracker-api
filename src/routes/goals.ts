import { Router, type Router as RouterT } from 'express';
import DecimalPkg from 'decimal.js';
const Decimal: any = DecimalPkg;

import { goalContributeSchema, goalCreateSchema, goalUpdateSchema } from '../shared/index.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { HttpError } from '../middleware/error.js';

export const goalsRouter: RouterT = Router();
goalsRouter.use(requireAuth);

goalsRouter.get('/', async (req, res, next) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.userId! },
      include: { contributions: { orderBy: { date: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      goals.map((g) => ({
        ...g,
        targetAmount: g.targetAmount.toString(),
        currentAmount: g.currentAmount.toString(),
        deadline: g.deadline?.toISOString() ?? null,
        contributions: g.contributions.map((c) => ({
          ...c,
          amount: c.amount.toString(),
          date: c.date.toISOString(),
        })),
      })),
    );
  } catch (err) {
    next(err);
  }
});

goalsRouter.post('/', validateBody(goalCreateSchema), async (req, res, next) => {
  try {
    const g = await prisma.goal.create({
      data: {
        userId: req.userId!,
        name: req.body.name,
        targetAmount: req.body.targetAmount,
        deadline: req.body.deadline ? new Date(req.body.deadline) : null,
        accountId: req.body.accountId ?? null,
      },
    });
    res.status(201).json({
      ...g,
      targetAmount: g.targetAmount.toString(),
      currentAmount: g.currentAmount.toString(),
    });
  } catch (err) {
    next(err);
  }
});

goalsRouter.patch('/:id', validateBody(goalUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Goal not found');
    const g = await prisma.goal.update({
      where: { id: existing.id },
      data: {
        ...req.body,
        deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
      },
    });
    res.json({
      ...g,
      targetAmount: g.targetAmount.toString(),
      currentAmount: g.currentAmount.toString(),
    });
  } catch (err) {
    next(err);
  }
});

goalsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Goal not found');
    await prisma.goal.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

goalsRouter.post('/:id/contribute', validateBody(goalContributeSchema), async (req, res, next) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Goal not found');
    const result = await prisma.$transaction(async (tx) => {
      const contribution = await tx.goalContribution.create({
        data: {
          goalId: existing.id,
          amount: req.body.amount,
          date: req.body.date ? new Date(req.body.date) : new Date(),
          note: req.body.note,
        },
      });
      const newAmount = new Decimal(existing.currentAmount.toString()).plus(req.body.amount);
      const status =
        newAmount.gte(existing.targetAmount.toString()) ? 'DONE' : existing.status;
      const goal = await tx.goal.update({
        where: { id: existing.id },
        data: { currentAmount: newAmount.toString(), status },
      });
      return { contribution, goal };
    });
    res.status(201).json({
      ...result.goal,
      targetAmount: result.goal.targetAmount.toString(),
      currentAmount: result.goal.currentAmount.toString(),
    });
  } catch (err) {
    next(err);
  }
});

