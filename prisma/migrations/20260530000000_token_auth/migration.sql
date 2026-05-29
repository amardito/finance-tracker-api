-- Make email/passwordHash optional and add tokenHash
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "tokenHash" TEXT;
CREATE UNIQUE INDEX "User_tokenHash_key" ON "User"("tokenHash");
