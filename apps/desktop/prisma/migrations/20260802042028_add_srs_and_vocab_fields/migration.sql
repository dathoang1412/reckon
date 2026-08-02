-- AlterTable
ALTER TABLE "VocabEntry" ADD COLUMN "definition" TEXT;
ALTER TABLE "VocabEntry" ADD COLUMN "note" TEXT;
ALTER TABLE "VocabEntry" ADD COLUMN "tags" TEXT;

-- CreateTable
CREATE TABLE "ReviewState" (
    "vocabId" TEXT NOT NULL PRIMARY KEY,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME NOT NULL,
    "lastReviewedAt" DATETIME
);
