-- AlterTable
ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN "googleId" TEXT,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "avatarBase64" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
