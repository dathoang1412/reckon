import { randomUUID } from "node:crypto";
import type { PrismaClient, VocabEntry } from "../../../generated/client";
import type { AiExample, AiRelatedWords } from "./aiTypes";
import { lookupEnglishWord, type DictionaryInfo } from "./dictionary";
import { translate, type TranslationResult } from "./translate";
import { getTranslateDirection } from "../utils/settings";

export function listVocabEntries(prisma: PrismaClient): Promise<VocabEntry[]> {
  return prisma.vocabEntry.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
}

export interface VocabPreview {
  result: TranslationResult;
  dictionary: DictionaryInfo | null;
  spellingSuggestion: string | null;
}

// Translates + enriches without touching the database, so the UI can show
// a result and let the user decide whether it's worth keeping before
// anything is saved.
export async function previewVocab(text: string): Promise<VocabPreview> {
  // Destructuring off spellingSuggestion here (not just typing it away)
  // matters: `result` goes on to saveVocab, which spreads it straight into
  // a Prisma `create` — a stray extra property would fail there.
  // getTranslateDirection() here (not a param) means every lookup path —
  // manual search in Popup.tsx/App.tsx and the selection hotkey in
  // hotkey.ts — honors the same direction override without each caller
  // having to thread it through.
  const { spellingSuggestion, ...result } = await translate(text, getTranslateDirection());
  const englishWord =
    result.sourceLang === "en" ? result.sourceText : result.targetLang === "en" ? result.targetText : null;
  const dictionary = englishWord ? await lookupEnglishWord(englishWord) : null;
  return { result, dictionary, spellingSuggestion };
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

// aiExamples/aiRelatedWords store as JSON-encoded columns, same
// reasoning/shape as targetMeanings/tags above.
export function parseAiExamples(entry: { aiExamples: string | null }): AiExample[] {
  if (!entry.aiExamples) return [];
  try {
    const parsed = JSON.parse(entry.aiExamples);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseAiRelatedWords(entry: { aiRelatedWords: string | null }): AiRelatedWords | null {
  if (!entry.aiRelatedWords) return null;
  try {
    return JSON.parse(entry.aiRelatedWords) as AiRelatedWords;
  } catch {
    return null;
  }
}

export interface VocabEntryPatch {
  note?: string | null;
  tags?: string[];
  definition?: string | null;
  aiExamples?: AiExample[];
  aiNuance?: string | null;
  aiRelatedWords?: AiRelatedWords | null;
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
      aiExamples: patch.aiExamples ? JSON.stringify(patch.aiExamples) : undefined,
      aiNuance: patch.aiNuance,
      aiRelatedWords: patch.aiRelatedWords !== undefined ? JSON.stringify(patch.aiRelatedWords) : undefined,
      updatedAt: new Date(),
      deviceId,
    },
  });
}
