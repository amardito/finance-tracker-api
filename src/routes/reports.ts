import { Router, type Router as RouterT } from 'express';
import { stringify } from 'csv-stringify/sync';
import DecimalPkg from 'decimal.js';
const Decimal: any = DecimalPkg;

type D = InstanceType<typeof Decimal>;
import { reportRangeSchema } from '../shared/index.js';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { computeNetWorth } from '../services/balances.js';

export const reportsRouter: RouterT = Router();
reportsRouter.use(requireAuth);

function rangeOrDefault(q: { from?: string; to?: string }): { from: Date; to: Date } {
  const now = new Date();
  return {
    from: q.from ? new Date(q.from) : startOfMonth(now),
    to: q.to ? new Date(q.to) : endOfMonth(now),
  };
}

reportsRouter.get('/summary', validateQuery(reportRangeSchema), async (req, res, next) => {
  try {
    const q = (req as never as { validatedQuery: { from?: string; to?: string } }).validatedQuery;
    const { from, to } = rangeOrDefault(q);
    const [income, expense, netWorth, txCount] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: req.userId!, type: 'INCOME', deletedAt: null, date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId!, type: 'EXPENSE', deletedAt: null, date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      computeNetWorth(req.userId!),
      prisma.transaction.count({
        where: { userId: req.userId!, deletedAt: null, date: { gte: from, lte: to } },
      }),
    ]);
    const incomeDec = new Decimal(income._sum.amount?.toString() ?? '0');
    const expenseDec = new Decimal(expense._sum.amount?.toString() ?? '0');
    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      income: incomeDec.toString(),
      expense: expenseDec.toString(),
      net: incomeDec.minus(expenseDec).toString(),
      netWorth: netWorth.toString(),
      transactionCount: txCount,
    });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get('/by-category', validateQuery(reportRangeSchema), async (req, res, next) => {
  try {
    const q = (req as never as { validatedQuery: { from?: string; to?: string } }).validatedQuery;
    const { from, to } = rangeOrDefault(q);
    const rows = await prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where: { userId: req.userId!, deletedAt: null, date: { gte: from, lte: to } },
      _sum: { amount: true },
    });
    const categories = await prisma.category.findMany({ where: { userId: req.userId! } });
    const map = new Map(categories.map((c) => [c.id, c]));
    res.json(
      rows.map((r) => ({
        categoryId: r.categoryId,
        category: map.get(r.categoryId) ?? null,
        type: r.type,
        amount: r._sum.amount?.toString() ?? '0',
      })),
    );
  } catch (err) {
    next(err);
  }
});

reportsRouter.get('/cashflow', validateQuery(reportRangeSchema), async (req, res, next) => {
  try {
    const q = (req as never as { validatedQuery: { from?: string; to?: string } }).validatedQuery;
    const { from, to } = rangeOrDefault(q);
    const txs = await prisma.transaction.findMany({
      where: { userId: req.userId!, deletedAt: null, date: { gte: from, lte: to } },
      select: { date: true, type: true, amount: true },
    });
    const days = eachDayOfInterval({ start: from, end: to });
    const buckets = new Map<string, { income: D; expense: D }>();
    for (const d of days) {
      buckets.set(format(d, 'yyyy-MM-dd'), { income: new Decimal(0), expense: new Decimal(0) });
    }
    for (const t of txs) {
      const key = format(t.date, 'yyyy-MM-dd');
      const b = buckets.get(key);
      if (!b) continue;
      const amt = new Decimal(t.amount.toString());
      if (t.type === 'INCOME') b.income = b.income.plus(amt);
      else b.expense = b.expense.plus(amt);
    }
    res.json(
      Array.from(buckets.entries()).map(([date, v]) => ({
        date,
        income: v.income.toString(),
        expense: v.expense.toString(),
        net: v.income.minus(v.expense).toString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

reportsRouter.get('/export.csv', validateQuery(reportRangeSchema), async (req, res, next) => {
  try {
    const q = (req as never as { validatedQuery: { from?: string; to?: string } }).validatedQuery;
    const { from, to } = rangeOrDefault(q);
    const txs = await prisma.transaction.findMany({
      where: { userId: req.userId!, deletedAt: null, date: { gte: from, lte: to } },
      include: { category: true, account: true, tags: { include: { tag: true } } },
      orderBy: { date: 'asc' },
    });
    const csv = stringify(
      txs.map((t) => ({
        date: t.date.toISOString().slice(0, 10),
        type: t.type,
        amount: t.amount.toString(),
        account: t.account.name,
        category: t.category.name,
        note: t.note ?? '',
        tags: t.tags.map((tt) => tt.tag.name).join('|'),
      })),
      { header: true, columns: ['date', 'type', 'amount', 'account', 'category', 'note', 'tags'] },
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions-${format(from, 'yyyyMMdd')}-${format(to, 'yyyyMMdd')}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

