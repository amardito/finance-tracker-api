import { Router, type Router as RouterT } from 'express';
import { Prisma } from '@prisma/client';
import {
  assistantProposalCreateSchema,
  assistantProposalFiltersSchema,
} from '../shared/index.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createAssistantProposal,
  executeAssistantProposal,
  transitionAssistantProposal,
} from '../services/assistant-proposals.js';

export const assistantRouter: RouterT = Router();
assistantRouter.use(requireAuth);

assistantRouter.get('/proposals', validateQuery(assistantProposalFiltersSchema), async (req, res, next) => {
  try {
    const q = (req as never as { validatedQuery: ReturnType<typeof assistantProposalFiltersSchema.parse> })
      .validatedQuery;
    const where: Prisma.AssistantProposalWhereInput = {
      userId: req.userId!,
      ...(q.status ? { status: q.status } : {}),
      ...(q.sourceChannel ? { sourceChannel: q.sourceChannel } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.assistantProposal.count({ where }),
      prisma.assistantProposal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    res.json({ total, page: q.page, limit: q.limit, items });
  } catch (err) {
    next(err);
  }
});

assistantRouter.post(
  '/proposals',
  validateBody(assistantProposalCreateSchema),
  async (req, res, next) => {
    try {
      const proposal = await createAssistantProposal(req.userId!, req.body);
      res.status(201).json(proposal);
    } catch (err) {
      next(err);
    }
  },
);

assistantRouter.post('/proposals/:id/approve', async (req, res, next) => {
  try {
    const proposal = await transitionAssistantProposal(req.userId!, req.params.id, 'approve');
    res.json(proposal);
  } catch (err) {
    next(err);
  }
});

assistantRouter.post('/proposals/:id/reject', async (req, res, next) => {
  try {
    const proposal = await transitionAssistantProposal(req.userId!, req.params.id, 'reject');
    res.json(proposal);
  } catch (err) {
    next(err);
  }
});

assistantRouter.post('/proposals/:id/execute', async (req, res, next) => {
  try {
    const result = await executeAssistantProposal(req.userId!, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
