import { randomUUID } from "node:crypto";
import type { PrismaClient, VocabEntry } from "../../../generated/client";
import { lookupEnglishWord, type DictionaryInfo } from "./dictionary";
import { translate, type TranslationResult } from "./translate";

export function listVocabEntries(prisma: PrismaClient): Promise<VocabEntry[]> {
  return prisma.vocabEntry.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
}

export interface VocabPreview {
  result: TranslationResult;
  dictionary: DictionaryInfo | null;
}

// Translates + enriches without touching the database, so the UI can show
// a result and let the user decide whether it's worth keeping before
// anything is saved.
export async function previewVocab(text: string): Promise<VocabPreview> {
  const result = await translate(text);
  const englishWord =
    result.sourceLang === "en" ? result.sourceText : result.targetLang === "en" ? result.targetText : null;
  const dictionary = englishWord ? await lookupEnglishWord(englishWord) : null;
  return { result, dictionary };
}

export function saveVocab(prisma: PrismaClient, deviceId: string, result: TranslationResult): Promise<VocabEntry> {
  const { targetMeanings, ...rest } = result;
  return prisma.vocabEntry.create({
    data: {
      id: randomUUID(),
      ...rest,
      targetMeanings: JSON.stringify(targetMeanings),
      updatedAt: new Date(),
      deviceId,
    },
  });
}

// VocabEntry stores targetMeanings as a JSON-encoded column (SQLite has no
// native array type) — this recovers the string[] shape the rest of the
// app works with, falling back to [targetText] for older rows saved before
// this field existed.
export function parseTargetMeanings(entry: { targetText: string; targetMeanings: string | null }): string[] {
  if (!entry.targetMeanings) return [entry.targetText];
  try {
    const parsed = JSON.parse(entry.targetMeanings);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [entry.targetText];
  } catch {
    return [entry.targetText];
  }
}

export function deleteVocabEntry(prisma: PrismaClient, deviceId: string, id: string): Promise<VocabEntry> {
  return prisma.vocabEntry.update({
    where: { id },
    data: { deletedAt: new Date(), updatedAt: new Date(), deviceId },
  });
}

export function setVocabEntrySet(
  prisma: PrismaClient,
  deviceId: string,
  id: string,
  setId: string | null,
): Promise<VocabEntry> {
  return prisma.vocabEntry.update({
    where: { id },
    data: { setId, updatedAt: new Date(), deviceId },
  });
}

// tags stores as a JSON-encoded column, same reasoning/shape as
// targetMeanings above — SQLite has no native array type.
export function parseTags(entry: { tags: string | null }): string[] {
  if (!entry.tags) return [];
  try {
    const parsed = JSON.parse(entry.tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface VocabEntryPatch {
  note?: string | null;
  tags?: string[];
  definition?: string | null;
}

export function updateVocabEntry(
  prisma: PrismaClient,
  deviceId: string,
  id: string,
  patch: VocabEntryPatch,
): Promise<VocabEntry> {
  return prisma.vocabEntry.update({
    where: { id },
    data: {
      note: patch.note,
      tags: patch.tags ? JSON.stringify(patch.tags) : undefined,
      definition: patch.definition,
      updatedAt: new Date(),
      deviceId,
    },
  });
}
