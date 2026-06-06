-- CreateTable
CREATE TABLE "ClawIdentityAlias" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ClawProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "canonicalIdHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClawIdentityAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClawIdentityAlias_provider_canonicalIdHash_idx" ON "ClawIdentityAlias"("provider", "canonicalIdHash");

-- CreateIndex
CREATE INDEX "ClawIdentityAlias_userId_idx" ON "ClawIdentityAlias"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClawIdentityAlias_provider_externalId_key" ON "ClawIdentityAlias"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "ClawIdentityAlias" ADD CONSTRAINT "ClawIdentityAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
