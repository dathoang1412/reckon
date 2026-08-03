-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VocabEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceText" TEXT NOT NULL,
    "sourceLang" TEXT NOT NULL,
    "targetText" TEXT NOT NULL,
    "targetMeanings" TEXT,
    "targetLang" TEXT NOT NULL,
    "definition" TEXT,
    "note" TEXT,
    "tags" TEXT,
    "setId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_VocabEntry" ("definition", "deletedAt", "deviceId", "id", "note", "setId", "sourceLang", "sourceText", "tags", "targetLang", "targetMeanings", "targetText", "updatedAt") SELECT "definition", "deletedAt", "deviceId", "id", "note", "setId", "sourceLang", "sourceText", "tags", "targetLang", "targetMeanings", "targetText", "updatedAt" FROM "VocabEntry";
DROP TABLE "VocabEntry";
ALTER TABLE "new_VocabEntry" RENAME TO "VocabEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
