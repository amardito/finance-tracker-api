import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middleware/error.js';
import { assistantTransactionPayloadSchema } from '../shared/index.js';
import { accountSetupPayloadSchema } from '../shared/schemas/account-setup.js';
import { recurringRuleProposalPayloadSchema } from '../shared/schemas/recurring-proposal.js';

type ProposalWithAuditInput = {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  proposalId?: string;
  payload?: Prisma.InputJsonValue;
};

export async function writeAssistantAudit(input: ProposalWithAuditInput): Promise<void> {
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
  await writeAssistantAudit({
    userId,
    proposalId: proposal.id,
    action: 'proposal.create',
    entity: 'AssistantProposal',
    entityId: proposal.id,
    payload: {
      actionType: proposal.actionType,
      sourceChannel: proposal.sourceChannel,
      clawMode: proposal.clawMode,
      riskLevel: proposal.riskLevel,
    },
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
  const status = transition === 'approve' ? 'APPROVED' : 'REJECTED';
  const updated = await prisma.assistantProposal.update({
    where: { id: proposal.id },
    data: { status },
  });
  await writeAssistantAudit({
    userId,
    proposalId: proposal.id,
    action: `proposal.${transition}`,
    entity: 'AssistantProposal',
    entityId: proposal.id,
    payload: {
      actionType: proposal.actionType,
      sourceChannel: proposal.sourceChannel,
      clawMode: proposal.clawMode,
    },
  });
  return updated;
}

export async function executeAssistantProposal(userId: string, proposalId: string) {
  const proposal = await prisma.assistantProposal.findFirst({ where: { id: proposalId, userId } });
  if (!proposal) throw new HttpError(404, 'NOT_FOUND', 'Proposal not found');
  if (proposal.status !== 'APPROVED') {
    throw new HttpError(409, 'INVALID_PROPOSAL_STATUS', 'Only approved proposals can execute');
  }

  try {
    if (proposal.actionType === 'CREATE_SETUP') {
      const payload = accountSetupPayloadSchema.parse(proposal.payload);
      const result = await prisma.$transaction(async (tx) => {
        const createdAccounts = await Promise.all(
          payload.accounts.map((acc) =>
            tx.account.create({
              data: {
                userId,
                name: acc.name,
                type: acc.type,
                openingBalance: acc.openingBalance,
                currency: acc.currency,
              },
            }),
          ),
        );
        const updatedProposal = await tx.assistantProposal.update({
          where: { id: proposal.id },
          data: {
            status: 'EXECUTED',
            executedAt: new Date(),
            resultEntity: 'Account',
            resultEntityId: createdAccounts[0]?.id,
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            proposalId: proposal.id,
            action: 'proposal.execute',
            entity: 'Account',
            entityId: createdAccounts[0]?.id,
            payload: {
              actionType: proposal.actionType,
              sourceChannel: proposal.sourceChannel,
              count: createdAccounts.length,
            },
          },
        });
        return { proposal: updatedProposal, accounts: createdAccounts };
      });
      return result;
    }

    if (proposal.actionType === 'CREATE_RECURRING_RULE') {
      const payload = recurringRuleProposalPayloadSchema.parse(proposal.payload);
      const result = await prisma.$transaction(async (tx) => {
        const recurringRule = await tx.recurringRule.create({
          data: {
            userId,
            accountId: payload.accountId,
            categoryId: payload.categoryId,
            amount: payload.amount,
            type: payload.type,
            cadence: payload.cadence,
            interval: payload.interval,
            startDate: new Date(payload.startDate),
            nextRunAt: new Date(payload.startDate),
            note: payload.note,
          },
        });
        const updatedProposal = await tx.assistantProposal.update({
          where: { id: proposal.id },
          data: {
            status: 'EXECUTED',
            executedAt: new Date(),
            resultEntity: 'RecurringRule',
            resultEntityId: recurringRule.id,
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            proposalId: proposal.id,
            action: 'proposal.execute',
            entity: 'RecurringRule',
            entityId: recurringRule.id,
            payload: {
              actionType: proposal.actionType,
              sourceChannel: proposal.sourceChannel,
            },
          },
        });
        return { proposal: updatedProposal, recurringRule };
      });
      return result;
    }

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
          payload: {
            actionType: proposal.actionType,
            sourceChannel: proposal.sourceChannel,
            clawMode: proposal.clawMode,
            resultEntity: 'Transaction',
            resultEntityId: transaction.id,
          },
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
      await writeAssistantAudit({
        userId,
        proposalId: proposal.id,
        action: 'proposal.fail',
        entity: 'AssistantProposal',
        entityId: proposal.id,
        payload: {
          actionType: proposal.actionType,
          sourceChannel: proposal.sourceChannel,
          reason: err.message,
        },
      });
      return { proposal: failed, transaction: null };
    }
    throw err;
  }
}
