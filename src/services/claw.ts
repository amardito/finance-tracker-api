import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middleware/error.js';
import { createAssistantProposal, writeAssistantAudit } from './assistant-proposals.js';
import {
  getCanonicalIdHash,
  getConnectionByClawIdentity,
  resolveClawIdentity,
} from './identity.js';
import type {
  ClawCommandIngressInput,
  ClawLinkCodeRedeemInput,
  ClawTransactionProposalInput,
  ClawAccountSetupProposalInput,
} from '../shared/index.js';
import { recurringRuleProposalPayloadSchema } from '../shared/schemas/recurring-proposal.js';
import { z } from 'zod';

export const clawRecurringRuleProposalSchema = z.object({
  provider: z.enum(['NANOBOT_WHATSAPP']),
  externalUserId: z.string(),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  amount: z.string(),
  type: z.enum(['INCOME', 'EXPENSE']),
  cadence: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  interval: z.number().int().min(1).default(1),
  startDate: z.string(),
  note: z.string().max(500).optional(),
  sourceText: z.string(),
});

export type ClawRecurringRuleProposalInput = z.infer<typeof clawRecurringRuleProposalSchema>;

const LINK_CODE_PREFIX = 'FT';

export async function listClawConnections(userId: string) {
  return prisma.clawConnection.findMany({
    where: { userId },
    orderBy: [{ status: 'asc' }, { linkedAt: 'desc' }],
    select: {
      id: true,
      provider: true,
      externalUserId: true,
      displayName: true,
      status: true,
      linkedAt: true,
      revokedAt: true,
      lastUsedAt: true,
    },
  });
}

export async function createClawLinkCode(userId: string, ttlMinutes: number) {
  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  await prisma.clawLinkCode.create({
    data: {
      userId,
      codeHash: hashLinkCode(code),
      expiresAt,
    },
  });
  await writeAssistantAudit({
    userId,
    action: 'claw.link_code.create',
    entity: 'ClawLinkCode',
    payload: { provider: 'NANOBOT_WHATSAPP', expiresAt: expiresAt.toISOString() },
  });
  return { code, expiresAt };
}

export async function redeemClawLinkCode(input: ClawLinkCodeRedeemInput) {
  const now = new Date();
  const codeHash = hashLinkCode(input.code);
  const linkCode = await prisma.clawLinkCode.findUnique({ where: { codeHash } });
  if (!linkCode) throw new HttpError(404, 'CLAW_LINK_CODE_NOT_FOUND', 'Link code not found');
  if (linkCode.redeemedAt) {
    throw new HttpError(409, 'CLAW_LINK_CODE_REDEEMED', 'Link code has already been redeemed');
  }
  if (linkCode.expiresAt <= now) {
    throw new HttpError(410, 'CLAW_LINK_CODE_EXPIRED', 'Link code has expired');
  }

  const existing = await getConnectionByClawIdentity(input.provider, input.externalUserId);
  if (existing && existing.status === 'LINKED' && existing.userId !== linkCode.userId) {
    throw new HttpError(409, 'CLAW_ID_ALREADY_LINKED', 'This Claw identity is already linked');
  }

  const result = await prisma.$transaction(async (tx) => {
    let connection;
    if (existing) {
      connection = await tx.clawConnection.update({
        where: { id: existing.id },
        data: {
          userId: linkCode.userId,
          displayName: input.displayName,
          status: 'LINKED',
          revokedAt: null,
          linkedAt: now,
        },
      });
    } else {
      connection = await tx.clawConnection.create({
        data: {
          userId: linkCode.userId,
          provider: input.provider,
          externalUserId: input.externalUserId,
          displayName: input.displayName,
        },
      });
    }

    await tx.clawIdentityAlias.upsert({
      where: {
        provider_externalId: {
          provider: input.provider,
          externalId: input.externalUserId,
        },
      },
      update: {
        userId: linkCode.userId,
        displayName: input.displayName,
      },
      create: {
        userId: linkCode.userId,
        provider: input.provider,
        externalId: input.externalUserId,
        canonicalIdHash: getCanonicalIdHash(input.provider, input.externalUserId),
        displayName: input.displayName,
      },
    });

    await tx.clawLinkCode.update({
      where: { id: linkCode.id },
      data: { redeemedAt: now, connectionId: connection.id },
    });
    await tx.auditLog.create({
      data: {
        userId: linkCode.userId,
        action: 'claw.connection.link',
        entity: 'ClawConnection',
        entityId: connection.id,
        payload: {
          provider: connection.provider,
          displayName: connection.displayName,
        },
      },
    });
    return connection;
  });

  return {
    id: result.id,
    provider: result.provider,
    displayName: result.displayName,
    status: result.status,
    linkedAt: result.linkedAt,
  };
}

export async function revokeClawConnection(userId: string, connectionId: string) {
  const existing = await prisma.clawConnection.findFirst({ where: { id: connectionId, userId } });
  if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Claw connection not found');
  if (existing.status === 'REVOKED') return existing;
  const revoked = await prisma.clawConnection.update({
    where: { id: existing.id },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
  await writeAssistantAudit({
    userId,
    action: 'claw.connection.revoke',
    entity: 'ClawConnection',
    entityId: revoked.id,
    payload: { provider: revoked.provider },
  });
  return revoked;
}

export async function createTransactionProposalFromClaw(input: ClawTransactionProposalInput) {
  const connection = await requireLinkedConnection(input.provider, input.externalUserId);
  const userId = connection.userId;
  const [account, category] = await Promise.all([
    prisma.account.findFirst({ where: { id: input.accountId, userId, archivedAt: null } }),
    prisma.category.findFirst({ where: { id: input.categoryId, userId, type: input.type } }),
  ]);
  if (!account) throw new HttpError(400, 'INVALID_ACCOUNT', 'Account not found');
  if (!category) throw new HttpError(400, 'INVALID_CATEGORY', 'Category not found');

  const payload = {
    accountId: input.accountId,
    categoryId: input.categoryId,
    amount: String(input.amount),
    type: input.type,
    date: input.date ?? new Date().toISOString(),
    note: input.note ?? input.sourceText,
    tagIds: input.tagIds,
  };
  const proposal = await createAssistantProposal(userId, {
    actionType: 'CREATE_TRANSACTION',
    sourceChannel: 'CLAW_WHATSAPP',
    clawMode: 'PICO',
    riskLevel: 'LOW',
    confidence: {
      score: input.confidence,
      parser: 'pico-text',
      sourceText: input.sourceText,
    },
    payload,
    summary: `${input.type === 'INCOME' ? 'Income' : 'Expense'} ${payload.amount} via ${account.name} for ${category.name}`,
  });
  await markConnectionUsed(connection.id);
  return { proposal, connectionId: connection.id };
}

export async function createAccountSetupProposalFromClaw(input: ClawAccountSetupProposalInput) {
  const connection = await requireLinkedConnection(input.provider, input.externalUserId);
  const userId = connection.userId;

  const summary = `Setup ${input.accounts.length} account(s): ${input.accounts.map((a) => a.name).join(', ')}`;

  const proposal = await createAssistantProposal(userId, {
    actionType: 'CREATE_SETUP',
    sourceChannel: 'CLAW_WHATSAPP',
    clawMode: 'NANO',
    riskLevel: 'MEDIUM',
    confidence: {
      source: 'marbot-account-setup',
      sourceText: input.sourceText,
    },
    payload: {
      accounts: input.accounts,
    },
    summary,
  });

  await markConnectionUsed(connection.id);
  return { proposal, connectionId: connection.id };
}

export async function createRecurringRuleProposalFromClaw(input: ClawRecurringRuleProposalInput) {
  const connection = await requireLinkedConnection(input.provider, input.externalUserId);
  const userId = connection.userId;

  const summary = `Create recurring ${input.type} rule: ${input.amount} ${input.cadence} for ${input.accountId}`;

  const proposal = await createAssistantProposal(userId, {
    actionType: 'CREATE_RECURRING_RULE',
    sourceChannel: 'CLAW_WHATSAPP',
    clawMode: 'NANO',
    riskLevel: 'MEDIUM',
    confidence: {
      source: 'marbot-recurring-rule',
      sourceText: input.sourceText,
    },
    payload: recurringRuleProposalPayloadSchema.parse(input),
    summary,
  });

  await markConnectionUsed(connection.id);
  return { proposal, connectionId: connection.id };
}

export async function handleClawCommand(input: ClawCommandIngressInput) {
  const connection = await requireLinkedConnection(input.provider, input.externalUserId);
  const parsed = await parsePicoTextCommand(connection.userId, input.text);
  if (!parsed.ready) {
    await markConnectionUsed(connection.id);
    return {
      status: 'NEEDS_MORE_INFO',
      parsed,
      message: `I need ${parsed.missingFields.join(', ')} before I can create a proposal.`,
    };
  }

  // FT-128: Add check for unsupported intents
  if (isUnsupportedIntent(input.text)) {
      await markConnectionUsed(connection.id);
      return {
        status: 'UNSUPPORTED_INTENT',
        message: 'I currently support creating transactions. Setup, budget, goal, report, and export features are coming soon.',
      };
  }

  const result = await createTransactionProposalFromClaw({
    provider: input.provider,
    externalUserId: input.externalUserId,
    accountId: parsed.accountId,
    categoryId: parsed.categoryId,
    amount: parsed.amount,
    type: parsed.type,
    date: new Date().toISOString(),
    note: parsed.note,
    sourceText: input.text,
    confidence: parsed.confidence,
  });
  return {
    status: 'PROPOSAL_CREATED',
    parsed,
    proposal: {
      id: result.proposal.id,
      summary: result.proposal.summary,
      status: result.proposal.status,
    },
  };
}

async function requireLinkedConnection(provider: string, externalUserId: string) {
  const connection = await getConnectionByClawIdentity(provider as any, externalUserId);
  if (!connection || connection.status !== 'LINKED') {
    throw new HttpError(401, 'CLAW_CONNECTION_REQUIRED', 'Claw identity is not linked or has been revoked');
  }
  return connection;
}

async function markConnectionUsed(connectionId: string): Promise<void> {
  await prisma.clawConnection.update({ where: { id: connectionId }, data: { lastUsedAt: new Date() } });
}

function generateLinkCode(): string {
  const raw = randomBytes(6).toString('hex').toUpperCase();
  return `${LINK_CODE_PREFIX}-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function hashLinkCode(code: string): string {
  return createHash('sha256').update(normalizeLinkCode(code)).digest('hex');
}

function normalizeLinkCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

function isUnsupportedIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  const unsupportedKeywords = [
    'setup', 'budget', 'goal', 'report', 'export', 'set up', 'create budget', 'create goal'
  ];
  return unsupportedKeywords.some(keyword => normalized.includes(keyword));
}

export async function parsePicoTextCommand(userId: string, text: string): Promise<any> {
  const normalized = text.toLowerCase();
  const type = inferTransactionType(normalized);
  const amount = parseCasualAmount(normalized);
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: 'asc' } }),
    prisma.category.findMany({ where: { userId, type }, orderBy: { createdAt: 'asc' } }),
  ]);
  const account = findNamedMatch(accounts, normalized) ?? accounts[0];
  const category = findNamedMatch(categories, normalized) ?? categories[0];
  const missingFields = [
    ...(amount ? [] : ['amount']),
    ...(account ? [] : ['account']),
    ...(category ? [] : ['category']),
  ];
  const confidence = Math.max(0.35, 0.95 - missingFields.length * 0.2);
  const note = text.trim();
  if (!amount || !account || !category) {
    return {
      ready: false,
      type,
      amount,
      accountId: account?.id,
      categoryId: category?.id,
      note,
      confidence,
      missingFields,
    };
  }
  return {
    ready: true,
    type,
    amount,
    accountId: account.id,
    categoryId: category.id,
    note,
    confidence,
    missingFields: [],
  };
}

function inferTransactionType(text: string): 'INCOME' | 'EXPENSE' {
  if (/\b(gaji|salary|income|paid|terima|dapat|masuk|received|revenue|sales)\b/.test(text)) {
    return 'INCOME';
  }
  return 'EXPENSE';
}

function parseCasualAmount(text: string): string | undefined {
  const match = text.match(/(?:rp\s*)?(\d+(?:[.,]\d+)?)(?:\s*)(rb|ribu|k|jt|juta|mio|m)?\b/i);
  if (!match) return undefined;
  const raw = match[1]!;
  const suffix = match[2]?.toLowerCase();
  let value: number;
  if (suffix === 'rb' || suffix === 'ribu' || suffix === 'k') {
    value = parseIndonesianNumber(raw) * 1_000;
  } else if (suffix === 'jt' || suffix === 'juta' || suffix === 'mio' || suffix === 'm') {
    value = parseIndonesianNumber(raw) * 1_000_000;
  } else {
    value = parsePlainAmount(raw);
  }
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value.toFixed(2);
}

function parseIndonesianNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

function parsePlainAmount(value: string): number {
  if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) return Number(value.replace(/\./g, ''));
  return Number(value.replace(',', '.'));
}

function findNamedMatch<T extends { name: string }>(items: T[], text: string): T | undefined {
  return items.find((item) => text.includes(item.name.toLowerCase()));
}

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
