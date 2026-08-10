import type { UpdateProfileRequest, UserProfile } from "@reckon/shared";

export type { UpdateProfileRequest, UserProfile };

export interface AiExample {
  sentence: string;
  translation: string;
}

export interface AiRelatedWords {
  synonyms: string[];
  antonyms: string[];
  forms: { pos: string; word: string }[];
}

export interface VocabEntryRow {
  id: string;
  sourceText: string;
  sourceLang: string;
  targetText: string;
  // Alternative meanings for targetText, e.g. "bank" -> ["ngân hàng", "bờ sông", ...].
  // Always includes targetText as the first entry.
  targetMeanings: string[];
  targetLang: string;
  setId: string | null;
  createdAt: string;
  note: string | null;
  tags: string[];
  definition: string | null;
  // Illustration URL — either pasted in by hand or picked from a Wikipedia
  // image search (see window.api.images.search below). imageCredit/
  // imageCreditUrl (the source article's title/URL) are only set for the
  // Wikipedia case, and must be re-displayed wherever imageUrl is shown, not
  // just at selection time (see VocabDetailModal's "Ảnh minh họa" section).
  imageUrl: string | null;
  imageCredit: string | null;
  imageCreditUrl: string | null;
  // AI-generated (Groq) enrichment — null/empty until the user asks for it
  // from VocabDetailModal, see window.api.ai.* below.
  aiExamples: AiExample[];
  aiNuance: string | null;
  aiRelatedWords: AiRelatedWords | null;
}

export interface VocabEntryPatch {
  note?: string | null;
  tags?: string[];
  definition?: string | null;
  imageUrl?: string | null;
  imageCredit?: string | null;
  imageCreditUrl?: string | null;
  aiExamples?: AiExample[];
  aiNuance?: string | null;
  aiRelatedWords?: AiRelatedWords | null;
}

export interface ImageCandidate {
  id: string;
  url: string;
  thumbUrl: string;
  // Wikipedia article title/URL the image came from — shown as the credit
  // and used as alt text (see VocabDetailModal's image picker).
  title: string;
  pageUrl: string;
}

export interface DueEntryRow extends VocabEntryRow {
  dueAt: string | null;
}

// Mirrors main/services/review/srs.ts's ReviewRating — declared
// independently (not imported) since preload never imports main-process
// code directly, same as every other type in this file.
export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface VocabSetRow {
  id: string;
  name: string;
}

export interface DictionaryDefinition {
  partOfSpeech: string;
  definition: string;
  example?: string;
}

export interface DictionaryInfo {
  phonetic?: string;
  audioUrl?: string;
  definitions: DictionaryDefinition[];
}

export interface TranslationResultPayload {
  result: VocabEntryRow;
  dictionary: DictionaryInfo | null;
}

export interface TranslationResultData {
  sourceText: string;
  sourceLang: string;
  targetText: string;
  targetMeanings: string[];
  targetLang: string;
}

export interface VocabPreview {
  result: TranslationResultData;
  dictionary: DictionaryInfo | null;
  // Google's own "did you mean" correction for likely-misspelled input —
  // null when it has none.
  spellingSuggestion: string | null;
}

export interface AuthSession {
  email: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface TagSuggestion {
  tags: string[];
  suggestedSetId: string | null;
  suggestedSetName: string | null;
}

export interface VocabCandidate {
  text: string;
  reason: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Result of the Ctrl+Shift+G grammar/naturalness check — see
// main/services/ai/aiTypes.ts's GrammarCheckResult (kept as a separate
// declaration here, same as every other AI result type in this file,
// since the preload boundary doesn't import main-process types directly).
export interface GrammarCheckResult {
  original: string;
  isNatural: boolean;
  corrected: string;
  explanation: string;
}

export type LogLevel = "info" | "warn" | "error";
// "app" is the Electron main process itself; "server" is the spawned
// NestJS sync backend (see main/services/system/server.ts) — see LogViewer.tsx.
export type LogSource = "app" | "server";

export interface LogEntry {
  id: number;
  timestamp: string;
  source: LogSource;
  level: LogLevel;
  message: string;
}

// "auto" guesses from the text (Vietnamese diacritics -> vi->en, else
// en->vi); the other two force a direction for when that guess would be
// wrong (a diacritic-less Vietnamese word, an ambiguous name, etc.). See
// TranslateDirectionToggle.tsx — surfaced next to the popup and App.tsx
// search boxes, not in Settings, since it's a per-lookup mode.
export type TranslateDirection = "auto" | "en-vi" | "vi-en";

export type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };
