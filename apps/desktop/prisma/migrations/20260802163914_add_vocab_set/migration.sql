-- AlterTable
ALTER TABLE "VocabEntry" ADD COLUMN "setId" TEXT;

-- CreateTable
CREATE TABLE "VocabSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deletedAt" DATETIME
);
