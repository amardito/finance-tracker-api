import { Router, type Router as RouterT } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import {
  applySetupTemplate,
  getSetupTemplate,
  listSetupTemplates,
} from '../services/setup-templates.js';

export const setupRouter: RouterT = Router();
setupRouter.use(requireAuth);

setupRouter.get('/templates', (_req, res) => {
  res.json({ items: listSetupTemplates() });
});

setupRouter.get('/templates/:id', (req, res, next) => {
  try {
    const template = getSetupTemplate(req.params.id);
    if (!template) throw new HttpError(404, 'NOT_FOUND', 'Setup template not found');
    res.json(template);
  } catch (err) {
    next(err);
  }
});

const applyTemplateSchema = z.object({
  templateId: z.string().min(1),
});

setupRouter.post('/apply-template', validateBody(applyTemplateSchema), async (req, res, next) => {
  try {
    const result = await applySetupTemplate(req.userId!, req.body.templateId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
