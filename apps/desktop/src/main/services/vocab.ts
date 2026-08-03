import { randomUUID } from "node:crypto";
import type { PrismaClient, VocabEntry } from "../../generated/client";
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
  return prisma.vocabEntry.create({
    data: { id: randomUUID(), ...result, updatedAt: new Date(), deviceId },
  });
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
