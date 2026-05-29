import { Router, type Router as RouterT } from 'express';
import { tagCreateSchema, tagUpdateSchema } from '../shared/index.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { HttpError } from '../middleware/error.js';

export const tagsRouter: RouterT = Router();
tagsRouter.use(requireAuth);

tagsRouter.get('/', async (req, res, next) => {
  try {
    const tags = await prisma.tag.findMany({
      where: { userId: req.userId! },
      orderBy: { name: 'asc' },
    });
    res.json(tags);
  } catch (err) {
    next(err);
  }
});

tagsRouter.post('/', validateBody(tagCreateSchema), async (req, res, next) => {
  try {
    const tag = await prisma.tag.create({ data: { ...req.body, userId: req.userId! } });
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});

tagsRouter.patch('/:id', validateBody(tagUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.tag.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Tag not found');
    const tag = await prisma.tag.update({ where: { id: existing.id }, data: req.body });
    res.json(tag);
  } catch (err) {
    next(err);
  }
});

tagsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.tag.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Tag not found');
    await prisma.tag.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

