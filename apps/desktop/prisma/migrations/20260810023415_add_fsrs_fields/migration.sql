-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReviewState" (
    "vocabId" TEXT NOT NULL PRIMARY KEY,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_ReviewState" ("dueAt", "easeFactor", "intervalDays", "lastReviewedAt", "repetitions", "vocabId") SELECT "dueAt", "easeFactor", "intervalDays", "lastReviewedAt", "repetitions", "vocabId" FROM "ReviewState";

-- Backfill: best-effort heuristic conversion from the old SM-2 fields, so
-- existing review progress carries over instead of resetting to "New".
-- NOTE: this app's own migration runner (main/db/migrate.ts) splits this
-- file on literal semicolons, so comment prose in this file must never
-- contain that character, only commas/periods/dashes.
--
-- difficulty: linear map of easeFactor's range [1.3 hardest .. 2.5
-- default/never-forgotten] onto FSRS's difficulty scale [10 hardest ..
-- 1 easiest].
-- stability / scheduledDays: carried over directly from intervalDays,
-- same "days until next review" concept, floored at 1.
-- elapsedDays: left at 0, ts-fsrs recomputes it from last_review anyway.
-- reps: carried from the old repetitions counter as the closest
-- available signal, though the semantics differ slightly.
-- lapses: not tracked before FSRS, defaults to 0.
-- state: repetitions > 0 means the last rating succeeded, so Review (2),
-- otherwise the last rating failed, so Relearning (3).
UPDATE "new_ReviewState" SET
  "difficulty" = MIN(10.0, MAX(1.0, 1.0 + (2.5 - "easeFactor") / 1.2 * 9.0)),
  "stability" = MAX("intervalDays", 1),
  "scheduledDays" = MAX("intervalDays", 1),
  "elapsedDays" = 0,
  "learningSteps" = 0,
  "reps" = "repetitions",
  "lapses" = 0,
  "state" = CASE WHEN "repetitions" > 0 THEN 2 ELSE 3 END;

DROP TABLE "ReviewState";
ALTER TABLE "new_ReviewState" RENAME TO "ReviewState";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
