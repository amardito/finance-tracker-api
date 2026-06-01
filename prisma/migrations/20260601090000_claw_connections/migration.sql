-- CreateEnum
CREATE TYPE "ClawConnectionStatus" AS ENUM ('LINKED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ClawProvider" AS ENUM ('NANOBOT_WHATSAPP');

-- CreateTable
CREATE TABLE "ClawConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ClawProvider" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "ClawConnectionStatus" NOT NULL DEFAULT 'LINKED',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ClawConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClawLinkCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "provider" "ClawProvider" NOT NULL DEFAULT 'NANOBOT_WHATSAPP',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "connectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClawLinkCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClawConnection_provider_externalUserId_key" ON "ClawConnection"("provider", "externalUserId");

-- CreateIndex
CREATE INDEX "ClawConnection_userId_status_idx" ON "ClawConnection"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClawLinkCode_codeHash_key" ON "ClawLinkCode"("codeHash");

-- CreateIndex
CREATE INDEX "ClawLinkCode_userId_createdAt_idx" ON "ClawLinkCode"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClawLinkCode_expiresAt_idx" ON "ClawLinkCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "ClawConnection" ADD CONSTRAINT "ClawConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClawLinkCode" ADD CONSTRAINT "ClawLinkCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClawLinkCode" ADD CONSTRAINT "ClawLinkCode_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ClawConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
