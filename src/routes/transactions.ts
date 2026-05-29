import { Router, type Router as RouterT } from 'express';
import {
  bulkTransactionSchema,
  transactionCreateSchema,
  transactionFiltersSchema,
  transactionUpdateSchema,
} from '../shared/index.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { HttpError } from '../middleware/error.js';

export const transactionsRouter: RouterT = Router();
transactionsRouter.use(requireAuth);

transactionsRouter.get('/', validateQuery(transactionFiltersSchema), async (req, res, next) => {
  try {
    const q = (req as never as { validatedQuery: ReturnType<typeof transactionFiltersSchema.parse> })
      .validatedQuery;
    const where: Prisma.TransactionWhereInput = {
      userId: req.userId!,
      deletedAt: null,
      ...(q.from || q.to
        ? {
            date: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.tagId ? { tags: { some: { tagId: q.tagId } } } : {}),
      ...(q.q ? { note: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          category: { select: { id: true, name: true, color: true, type: true } },
          account: { select: { id: true, name: true, type: true } },
          tags: { include: { tag: true } },
        },
      }),
    ]);
    res.json({
      total,
      page: q.page,
      limit: q.limit,
      items: items.map((t) => ({
        ...t,
        amount: t.amount.toString(),
        date: t.date.toISOString(),
        createdAt: t.createdAt.toISOString(),
        tags: t.tags.map((tt) => tt.tag),
      })),
    });
  } catch (err) {
    next(err);
  }
});

transactionsRouter.post('/', validateBody(transactionCreateSchema), async (req, res, next) => {
  try {
    const { tagIds = [], ...data } = req.body;
    const account = await prisma.account.findFirst({
      where: { id: data.accountId, userId: req.userId! },
    });
    if (!account) throw new HttpError(400, 'INVALID_ACCOUNT', 'Account not found');
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId: req.userId! },
    });
    if (!category) throw new HttpError(400, 'INVALID_CATEGORY', 'Category not found');

    const tx = await prisma.transaction.create({
      data: {
        userId: req.userId!,
        accountId: data.accountId,
        categoryId: data.categoryId,
        amount: data.amount,
        type: data.type,
        date: new Date(data.date),
        note: data.note,
        tags: tagIds.length
          ? { create: tagIds.map((id: string) => ({ tagId: id })) }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });
    res.status(201).json({
      ...tx,
      amount: tx.amount.toString(),
      date: tx.date.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      tags: tx.tags.map((tt) => tt.tag),
    });
  } catch (err) {
    next(err);
  }
});

transactionsRouter.patch('/:id', validateBody(transactionUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Transaction not found');
    const { tagIds, ...data } = req.body;
    const tx = await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        ...(tagIds
          ? {
              tags: {
                deleteMany: {},
                create: tagIds.map((id: string) => ({ tagId: id })),
              },
            }
          : {}),
      },
      include: { tags: { include: { tag: true } } },
    });
    res.json({
      ...tx,
      amount: tx.amount.toString(),
      date: tx.date.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      tags: tx.tags.map((tt) => tt.tag),
    });
  } catch (err) {
    next(err);
  }
});

transactionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.userId!, deletedAt: null },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Transaction not found');
    await prisma.transaction.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

transactionsRouter.post('/bulk', validateBody(bulkTransactionSchema), async (req, res, next) => {
  try {
    const items = req.body.transactions as Array<{
      accountId: string;
      categoryId: string;
      amount: string;
      type: 'INCOME' | 'EXPENSE';
      date: string;
      note?: string;
    }>;
    const created = await prisma.$transaction(
      items.map((t) =>
        prisma.transaction.create({
          data: {
            userId: req.userId!,
            accountId: t.accountId,
            categoryId: t.categoryId,
            amount: t.amount,
            type: t.type,
            date: new Date(t.date),
            note: t.note,
          },
        }),
      ),
    );
    res.status(201).json({ inserted: created.length });
  } catch (err) {
    next(err);
  }
});

