/*
  Warnings:

  - You are about to drop the column `imageAuthorName` on the `VocabEntry` table. All the data in the column will be lost.
  - You are about to drop the column `imageAuthorUrl` on the `VocabEntry` table. All the data in the column will be lost.
  - You are about to drop the column `imageUnsplashUrl` on the `VocabEntry` table. All the data in the column will be lost.

*/
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
    "imageUrl" TEXT,
    "imageCredit" TEXT,
    "imageCreditUrl" TEXT,
    "aiExamples" TEXT,
    "aiNuance" TEXT,
    "aiRelatedWords" TEXT,
    "setId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_VocabEntry" ("aiExamples", "aiNuance", "aiRelatedWords", "createdAt", "definition", "deletedAt", "deviceId", "id", "imageUrl", "note", "setId", "sourceLang", "sourceText", "tags", "targetLang", "targetMeanings", "targetText", "updatedAt") SELECT "aiExamples", "aiNuance", "aiRelatedWords", "createdAt", "definition", "deletedAt", "deviceId", "id", "imageUrl", "note", "setId", "sourceLang", "sourceText", "tags", "targetLang", "targetMeanings", "targetText", "updatedAt" FROM "VocabEntry";
DROP TABLE "VocabEntry";
ALTER TABLE "new_VocabEntry" RENAME TO "VocabEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
