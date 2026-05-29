import { Router, type Router as RouterT } from 'express';
import { categoryCreateSchema, categoryUpdateSchema } from '../shared/index.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { HttpError } from '../middleware/error.js';

export const categoriesRouter: RouterT = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get('/', async (req, res, next) => {
  try {
    const cats = await prisma.category.findMany({
      where: { userId: req.userId! },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    res.json(cats);
  } catch (err) {
    next(err);
  }
});

categoriesRouter.post('/', validateBody(categoryCreateSchema), async (req, res, next) => {
  try {
    const cat = await prisma.category.create({
      data: { ...req.body, userId: req.userId! },
    });
    res.status(201).json(cat);
  } catch (err) {
    next(err);
  }
});

categoriesRouter.patch('/:id', validateBody(categoryUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Category not found');
    const cat = await prisma.category.update({
      where: { id: existing.id },
      data: req.body,
    });
    res.json(cat);
  } catch (err) {
    next(err);
  }
});

categoriesRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Category not found');
    const txCount = await prisma.transaction.count({ where: { categoryId: existing.id } });
    if (txCount > 0) {
      throw new HttpError(409, 'IN_USE', 'Cannot delete category with transactions');
    }
    await prisma.category.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

