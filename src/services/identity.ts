import { prisma } from '../lib/prisma.js';
import type { ClawProvider } from '@prisma/client';

// Normalize WhatsApp ID to remove device suffixes and standardize format
export function normalizeWhatsAppId(id: string | null | undefined): string {
  if (!id) return '';
  const normalized = id.trim();

  if (normalized.includes('@')) {
    const parts = normalized.split('@');
    const localPart = parts[0] || '';
    const domain = parts[1] || '';
    
    // For WhatsApp DM (s.whatsapp.net) and LID
    if (domain === 's.whatsapp.net' || domain === 'c.us' || domain === 'lid') {
      const subParts = localPart.split('.');
      return subParts[0] ?? localPart;
    }
    
    // For Group IDs (@g.us), return the full ID including domain
    if (domain === 'g.us') {
      return normalized;
    }
    
    return normalized;
  }
  
  return normalized;
}

// Generate a consistent hash for the identity (can be used as canonicalIdHash)
export function getCanonicalIdHash(provider: string, externalId: string): string {
  const normalized = normalizeWhatsAppId(externalId);
  return `${provider.toLowerCase()}:${normalized.toLowerCase()}`;
}

// Resolve or create an identity alias for the given external ID
export async function resolveClawIdentity(
  provider: ClawProvider,
  externalId: string,
  displayName?: string
) {
  const canonicalIdHash = getCanonicalIdHash(provider, externalId);
  
  // Look for existing alias
  const existingAlias = await prisma.clawIdentityAlias.findFirst({
    where: {
      provider,
      canonicalIdHash
    },
    include: {
      user: true
    }
  });
  
  if (existingAlias) {
    if (displayName && existingAlias.displayName !== displayName) {
      await prisma.clawIdentityAlias.update({
        where: { id: existingAlias.id },
        data: { displayName }
      });
    }
    return existingAlias;
  }
  
  // Find connection to get userId
  const connection = await prisma.clawConnection.findFirst({
    where: {
      provider,
      externalUserId: externalId
    },
    include: {
      user: true
    }
  });
  
  if (connection) {
    return await prisma.clawIdentityAlias.create({
      data: {
        userId: connection.userId,
        provider,
        externalId,
        canonicalIdHash,
        displayName: displayName ?? connection.displayName ?? undefined
      }
    });
  }
  
  throw new Error(`No existing connection found for provider ${provider} and externalId ${externalId}`);
}

// Get user ID from external ID using the alias system
export async function getUserIdFromClawIdentity(
  provider: ClawProvider,
  externalId: string
): Promise<string | null> {
  const canonicalIdHash = getCanonicalIdHash(provider, externalId);
  
  const alias = await prisma.clawIdentityAlias.findFirst({
    where: {
      provider,
      canonicalIdHash
    },
    select: {
      userId: true
    }
  });
  
  return alias ? alias.userId : null;
}

// Get connection by external ID using the alias system
export async function getConnectionByClawIdentity(
  provider: ClawProvider,
  externalId: string
) {
  const userId = await getUserIdFromClawIdentity(provider, externalId);
  if (!userId) return null;
  
  // We need to find the connection that matches this userId and provider and that is linked.
  // However there could be multiple connections? The unique constraint is on provider+externalUserId,
  // but we are using canonical identity. So we should find the connection that matches the userId and provider
  // and that is linked, and whose externalId maps to this canonicalId (via alias).
  // Simpler: find all connections for this userId and provider, then check if any of their externalIds
  // map to the same canonicalId.
  const connections = await prisma.clawConnection.findMany({
    where: {
      userId,
      provider,
      status: 'LINKED'
    }
  });
  
  for (const conn of connections) {
    const connCanonicalHash = getCanonicalIdHash(provider, conn.externalUserId);
    if (connCanonicalHash === getCanonicalIdHash(provider, externalId)) {
      return conn;
    }
  }
  
  return null;
}
