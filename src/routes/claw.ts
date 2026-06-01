import { Router, type Router as RouterT } from 'express';
import {
  clawCommandIngressSchema,
  clawLinkCodeCreateSchema,
  clawLinkCodeRedeemSchema,
  clawTransactionProposalSchema,
} from '../shared/index.js';
import { requireAuth, requireServiceAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  createClawLinkCode,
  createTransactionProposalFromClaw,
  handleClawCommand,
  listClawConnections,
  redeemClawLinkCode,
  revokeClawConnection,
} from '../services/claw.js';

export const clawRouter: RouterT = Router();
clawRouter.use(requireAuth);

clawRouter.get('/connections', async (req, res, next) => {
  try {
    res.json({ items: await listClawConnections(req.userId!) });
  } catch (err) {
    next(err);
  }
});

clawRouter.post('/link-codes', validateBody(clawLinkCodeCreateSchema), async (req, res, next) => {
  try {
    const result = await createClawLinkCode(req.userId!, req.body.ttlMinutes);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

clawRouter.post('/connections/:id/revoke', async (req, res, next) => {
  try {
    res.json(await revokeClawConnection(req.userId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

export const clawServiceRouter: RouterT = Router();
clawServiceRouter.use(requireServiceAuth);

clawServiceRouter.post('/link-codes/redeem', validateBody(clawLinkCodeRedeemSchema), async (req, res, next) => {
  try {
    res.json(await redeemClawLinkCode(req.body));
  } catch (err) {
    next(err);
  }
});

clawServiceRouter.post('/proposals/transaction', validateBody(clawTransactionProposalSchema), async (req, res, next) => {
  try {
    res.status(201).json(await createTransactionProposalFromClaw(req.body));
  } catch (err) {
    next(err);
  }
});

clawServiceRouter.post('/commands', validateBody(clawCommandIngressSchema), async (req, res, next) => {
  try {
    res.json(await handleClawCommand(req.body));
  } catch (err) {
    next(err);
  }
});
