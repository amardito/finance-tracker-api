import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middleware/error.js';
import { assistantTransactionPayloadSchema } from '../shared/index.js';

type ProposalWithAuditInput = {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  proposalId?: string;
  payload?: Prisma.InputJsonValue;
};

async function writeAudit(input: ProposalWithAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      proposalId: input.proposalId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      payload: input.payload,
    },
  });
}

export async function createAssistantProposal(
  userId: string,
  input: {
    actionType: string;
    sourceChannel: string;
    clawMode: string;
    riskLevel: string;
    confidence?: Record<string, unknown>;
    payload: Record<string, unknown>;
    summary: string;
    expiresAt?: string;
  },
) {
  const proposal = await prisma.assistantProposal.create({
    data: {
      userId,
      actionType: input.actionType as never,
      sourceChannel: input.sourceChannel as never,
      clawMode: input.clawMode as never,
      riskLevel: input.riskLevel as never,
      confidence: input.confidence as Prisma.InputJsonValue | undefined,
      payload: input.payload as Prisma.InputJsonValue,
      summary: input.summary,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });
  await writeAudit({
    userId,
    proposalId: proposal.id,
    action: 'proposal.create',
    entity: 'AssistantProposal',
    entityId: proposal.id,
    payload: { actionType: proposal.actionType, sourceChannel: proposal.sourceChannel },
  });
  return proposal;
}

export async function transitionAssistantProposal(
  userId: string,
  proposalId: string,
  transition: 'approve' | 'reject',
) {
  const proposal = await prisma.assistantProposal.findFirst({ where: { id: proposalId, userId } });
  if (!proposal) throw new HttpError(404, 'NOT_FOUND', 'Proposal not found');
  if (proposal.status !== 'PENDING') {
    throw new HttpError(409, 'INVALID_PROPOSAL_STATUS', 'Only pending proposals can transition');
  }
  if (proposal.expiresAt && proposal.expiresAt <= new Date()) {
    const expired = await prisma.assistantProposal.update({
      where: { id: proposal.id },
      data: { status: 'EXPIRED' },
    });
    throw new HttpError(409, 'PROPOSAL_EXPIRED', `Proposal expired at ${expired.expiresAt?.toISOString()}`);
  }
  const status = transition === 'approve' ? 'APPROVED' : 'REJECTED';
  const updated = await prisma.assistantProposal.update({
    where: { id: proposal.id },
    data: { status },
  });
  await writeAudit({
    userId,
    proposalId: proposal.id,
    action: `proposal.${transition}`,
    entity: 'AssistantProposal',
    entityId: proposal.id,
  });
  return updated;
}

export async function executeAssistantProposal(userId: string, proposalId: string) {
  const proposal = await prisma.assistantProposal.findFirst({ where: { id: proposalId, userId } });
  if (!proposal) throw new HttpError(404, 'NOT_FOUND', 'Proposal not found');
  if (proposal.status !== 'APPROVED') {
    throw new HttpError(409, 'INVALID_PROPOSAL_STATUS', 'Only approved proposals can execute');
  }
  if (proposal.expiresAt && proposal.expiresAt <= new Date()) {
    await prisma.assistantProposal.update({
      where: { id: proposal.id },
      data: { status: 'EXPIRED' },
    });
    throw new HttpError(409, 'PROPOSAL_EXPIRED', `Proposal expired at ${proposal.expiresAt.toISOString()}`);
  }

  try {
    if (proposal.actionType !== 'CREATE_TRANSACTION') {
      throw new HttpError(
        422,
        'UNSUPPORTED_PROPOSAL_ACTION',
        `Execution is not implemented for ${proposal.actionType}`,
      );
    }

    const payload = assistantTransactionPayloadSchema.parse(proposal.payload);
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: { id: payload.accountId, userId },
      });
      if (!account) throw new HttpError(400, 'INVALID_ACCOUNT', 'Account not found');
      const category = await tx.category.findFirst({
        where: { id: payload.categoryId, userId },
      });
      if (!category) throw new HttpError(400, 'INVALID_CATEGORY', 'Category not found');
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: payload.accountId,
          categoryId: payload.categoryId,
          amount: payload.amount,
          type: payload.type,
          date: new Date(payload.date),
          note: payload.note,
          tags: payload.tagIds?.length
            ? { create: payload.tagIds.map((id) => ({ tagId: id })) }
            : undefined,
        },
      });
      const updatedProposal = await tx.assistantProposal.update({
        where: { id: proposal.id },
        data: {
          status: 'EXECUTED',
          executedAt: new Date(),
          resultEntity: 'Transaction',
          resultEntityId: transaction.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          proposalId: proposal.id,
          action: 'proposal.execute',
          entity: 'Transaction',
          entityId: transaction.id,
          payload: { actionType: proposal.actionType },
        },
      });
      return { proposal: updatedProposal, transaction };
    });
    return result;
  } catch (err) {
    if (err instanceof HttpError && err.code === 'UNSUPPORTED_PROPOSAL_ACTION') {
      const failed = await prisma.assistantProposal.update({
        where: { id: proposal.id },
        data: { status: 'FAILED', failureReason: err.message },
      });
      await writeAudit({
        userId,
        proposalId: proposal.id,
        action: 'proposal.fail',
        entity: 'AssistantProposal',
        entityId: proposal.id,
        payload: { reason: err.message },
      });
      return { proposal: failed, transaction: null };
    }
    throw err;
  }
}
