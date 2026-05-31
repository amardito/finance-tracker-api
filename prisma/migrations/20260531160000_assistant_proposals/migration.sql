-- Assistant proposal infrastructure
CREATE TYPE "AssistantProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED', 'FAILED');
CREATE TYPE "AssistantProposalSource" AS ENUM ('WEB_GUIDED', 'WEB_AI', 'CLAW_WHATSAPP', 'RECEIPT_WORKER', 'MCP');
CREATE TYPE "ClawMode" AS ENUM ('NONE', 'PICO', 'NANO', 'OPEN');
CREATE TYPE "AssistantRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "AssistantActionType" AS ENUM ('CREATE_TRANSACTION', 'CREATE_SETUP', 'CREATE_TRANSFER', 'CREATE_BUDGET', 'CREATE_GOAL', 'CREATE_RECURRING_RULE', 'BULK_CATEGORY_CHANGE', 'RECEIPT_TRANSACTION');

CREATE TABLE "AssistantProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" "AssistantActionType" NOT NULL,
    "status" "AssistantProposalStatus" NOT NULL DEFAULT 'PENDING',
    "sourceChannel" "AssistantProposalSource" NOT NULL,
    "clawMode" "ClawMode" NOT NULL DEFAULT 'NONE',
    "riskLevel" "AssistantRiskLevel" NOT NULL,
    "confidence" JSONB,
    "payload" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "resultEntity" TEXT,
    "resultEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantProposal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuditLog" ADD COLUMN "proposalId" TEXT;

CREATE INDEX "AssistantProposal_userId_status_createdAt_idx" ON "AssistantProposal"("userId", "status", "createdAt");
CREATE INDEX "AssistantProposal_sourceChannel_idx" ON "AssistantProposal"("sourceChannel");
CREATE INDEX "AuditLog_proposalId_idx" ON "AuditLog"("proposalId");

ALTER TABLE "AssistantProposal" ADD CONSTRAINT "AssistantProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AssistantProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
