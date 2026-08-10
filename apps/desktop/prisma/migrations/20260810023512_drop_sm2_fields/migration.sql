/*
  Warnings:

  - You are about to drop the column `easeFactor` on the `ReviewState` table. All the data in the column will be lost.
  - You are about to drop the column `intervalDays` on the `ReviewState` table. All the data in the column will be lost.
  - You are about to drop the column `repetitions` on the `ReviewState` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReviewState" (
    "vocabId" TEXT NOT NULL PRIMARY KEY,
    "stability" REAL NOT NULL DEFAULT 0,
    "difficulty" REAL NOT NULL DEFAULT 0,
    "elapsedDays" INTEGER NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME NOT NULL,
    "lastReviewedAt" DATETIME
);
INSERT INTO "new_ReviewState" ("difficulty", "dueAt", "elapsedDays", "lapses", "lastReviewedAt", "learningSteps", "reps", "scheduledDays", "stability", "state", "vocabId") SELECT "difficulty", "dueAt", "elapsedDays", "lapses", "lastReviewedAt", "learningSteps", "reps", "scheduledDays", "stability", "state", "vocabId" FROM "ReviewState";
DROP TABLE "ReviewState";
ALTER TABLE "new_ReviewState" RENAME TO "ReviewState";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
