import { Router, type Router as RouterT } from 'express';
import { budgetCreateSchema, budgetUpdateSchema } from '../shared/index.js';
import DecimalPkg from 'decimal.js';
const Decimal: any = DecimalPkg;

import { startOfMonth, startOfWeek, endOfMonth, endOfWeek } from 'date-fns';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { HttpError } from '../middleware/error.js';

export const budgetsRouter: RouterT = Router();
budgetsRouter.use(requireAuth);

budgetsRouter.get('/', async (req, res, next) => {
  try {
    const budgets = await prisma.budget.findMany({
      where: { userId: req.userId! },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(
      budgets.map((b) => ({
        ...b,
        amount: b.amount.toString(),
        startDate: b.startDate.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

budgetsRouter.get('/progress', async (req, res, next) => {
  try {
    const budgets = await prisma.budget.findMany({
      where: { userId: req.userId! },
      include: { category: true },
    });
    const now = new Date();
    const out = await Promise.all(
      budgets.map(async (b) => {
        const periodStart =
          b.period === 'MONTHLY' ? startOfMonth(now) : startOfWeek(now, { weekStartsOn: 1 });
        const periodEnd =
          b.period === 'MONTHLY' ? endOfMonth(now) : endOfWeek(now, { weekStartsOn: 1 });
        const spent = await prisma.transaction.aggregate({
          where: {
            userId: req.userId!,
            categoryId: b.categoryId,
            type: 'EXPENSE',
            deletedAt: null,
            date: { gte: periodStart, lte: periodEnd },
          },
          _sum: { amount: true },
        });
        const spentDec = new Decimal(spent._sum.amount?.toString() ?? '0');
        const limitDec = new Decimal(b.amount.toString());
        const ratio = limitDec.gt(0) ? spentDec.div(limitDec).toNumber() : 0;
        return {
          id: b.id,
          categoryId: b.categoryId,
          category: b.category,
          period: b.period,
          amount: limitDec.toString(),
          spent: spentDec.toString(),
          remaining: limitDec.minus(spentDec).toString(),
          ratio,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          status: ratio >= 1 ? 'OVER' : ratio >= 0.8 ? 'WARN' : 'OK',
        };
      }),
    );
    res.json(out);
  } catch (err) {
    next(err);
  }
});

budgetsRouter.post('/', validateBody(budgetCreateSchema), async (req, res, next) => {
  try {
    const cat = await prisma.category.findFirst({
      where: { id: req.body.categoryId, userId: req.userId! },
    });
    if (!cat) throw new HttpError(400, 'INVALID_CATEGORY', 'Category not found');
    const b = await prisma.budget.create({
      data: {
        userId: req.userId!,
        categoryId: req.body.categoryId,
        amount: req.body.amount,
        period: req.body.period,
        startDate: new Date(req.body.startDate),
        rollover: req.body.rollover ?? false,
      },
    });
    res.status(201).json({
      ...b,
      amount: b.amount.toString(),
      startDate: b.startDate.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

budgetsRouter.patch('/:id', validateBody(budgetUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Budget not found');
    const b = await prisma.budget.update({
      where: { id: existing.id },
      data: {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      },
    });
    res.json({ ...b, amount: b.amount.toString(), startDate: b.startDate.toISOString() });
  } catch (err) {
    next(err);
  }
});

budgetsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Budget not found');
    await prisma.budget.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

