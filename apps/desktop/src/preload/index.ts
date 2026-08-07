import { contextBridge, ipcRenderer } from "electron";
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
  aiExamples?: AiExample[];
  aiNuance?: string | null;
  aiRelatedWords?: AiRelatedWords | null;
}

export interface DueEntryRow extends VocabEntryRow {
  dueAt: string | null;
}

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

export type LogLevel = "info" | "warn" | "error";
// "app" is the Electron main process itself; "server" is the spawned
// NestJS sync backend (see main/services/server.ts) — see LogViewer.tsx.
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

const api = {
  vocab: {
    list: () => ipcRenderer.invoke("vocab:list") as Promise<VocabEntryRow[]>,
    preview: (text: string) => ipcRenderer.invoke("vocab:preview", text) as Promise<VocabPreview>,
    save: (result: TranslationResultData) => ipcRenderer.invoke("vocab:save", result) as Promise<VocabEntryRow>,
    delete: (id: string) => ipcRenderer.invoke("vocab:delete", id) as Promise<VocabEntryRow>,
    setSet: (id: string, setId: string | null) =>
      ipcRenderer.invoke("vocab:setSet", id, setId) as Promise<VocabEntryRow>,
    update: (id: string, patch: VocabEntryPatch) =>
      ipcRenderer.invoke("vocab:update", id, patch) as Promise<VocabEntryRow>,
  },
  vocabSet: {
    list: () => ipcRenderer.invoke("vocabSet:list") as Promise<VocabSetRow[]>,
    create: (name: string) => ipcRenderer.invoke("vocabSet:create", name) as Promise<VocabSetRow>,
    rename: (id: string, name: string) => ipcRenderer.invoke("vocabSet:rename", id, name) as Promise<VocabSetRow>,
    delete: (id: string) => ipcRenderer.invoke("vocabSet:delete", id) as Promise<VocabSetRow>,
  },
  dictionary: {
    lookup: (word: string) => ipcRenderer.invoke("dictionary:lookup", word) as Promise<DictionaryInfo | null>,
  },
  tts: {
    // Base64-encoded MP3 — IPC's structured clone handles ArrayBuffer fine,
    // but base64 keeps the channel's payload type simple/JSON-serializable
    // like the rest of the API.
    speak: (text: string, lang: string) => ipcRenderer.invoke("tts:speak", text, lang) as Promise<string>,
  },
  sync: {
    run: () => ipcRenderer.invoke("sync:run") as Promise<{ pushed: number; pulled: number }>,
  },
  auth: {
    signup: (email: string, password: string) =>
      ipcRenderer.invoke("auth:signup", email, password) as Promise<AuthSession>,
    login: (email: string, password: string) =>
      ipcRenderer.invoke("auth:login", email, password) as Promise<AuthSession>,
    loginWithGoogle: () => ipcRenderer.invoke("auth:loginWithGoogle") as Promise<AuthSession>,
    logout: () => ipcRenderer.invoke("auth:logout") as Promise<void>,
    getSession: () => ipcRenderer.invoke("auth:getSession") as Promise<AuthSession | null>,
    getProfile: () => ipcRenderer.invoke("auth:getProfile") as Promise<UserProfile>,
    updateProfile: (patch: UpdateProfileRequest) =>
      ipcRenderer.invoke("auth:updateProfile", patch) as Promise<UserProfile>,
  },
  review: {
    // limit: null means no cap — review every entry currently due, not
    // just the first `limit` of them (see Review.tsx's word-limit selector).
    due: (limit?: number | null, setId?: string | null) =>
      ipcRenderer.invoke("review:due", limit, setId) as Promise<DueEntryRow[]>,
    rate: (vocabId: string, remembered: boolean) =>
      ipcRenderer.invoke("review:rate", vocabId, remembered) as Promise<void>,
  },
  settings: {
    getHotkey: () => ipcRenderer.invoke("settings:getHotkey") as Promise<string>,
    setHotkey: (accelerator: string) => ipcRenderer.invoke("settings:setHotkey", accelerator) as Promise<boolean>,
    getSearchHotkey: () => ipcRenderer.invoke("settings:getSearchHotkey") as Promise<string>,
    setSearchHotkey: (accelerator: string) =>
      ipcRenderer.invoke("settings:setSearchHotkey", accelerator) as Promise<boolean>,
    getGroqApiKey: () => ipcRenderer.invoke("settings:getGroqApiKey") as Promise<string>,
    setGroqApiKey: (key: string) => ipcRenderer.invoke("settings:setGroqApiKey", key) as Promise<void>,
    hasGroqApiKey: () => ipcRenderer.invoke("settings:hasGroqApiKey") as Promise<boolean>,
    testGroqApiKey: (key: string) => ipcRenderer.invoke("settings:testGroqApiKey", key) as Promise<void>,
    getAutoSave: () => ipcRenderer.invoke("settings:getAutoSave") as Promise<boolean>,
    setAutoSave: (value: boolean) => ipcRenderer.invoke("settings:setAutoSave", value) as Promise<void>,
    getTranslateDirection: () => ipcRenderer.invoke("settings:getTranslateDirection") as Promise<TranslateDirection>,
    setTranslateDirection: (value: TranslateDirection) =>
      ipcRenderer.invoke("settings:setTranslateDirection", value) as Promise<void>,
    getReviewLimit: () => ipcRenderer.invoke("settings:getReviewLimit") as Promise<number | null>,
    setReviewLimit: (value: number | null) => ipcRenderer.invoke("settings:setReviewLimit", value) as Promise<void>,
    getDarkMode: () => ipcRenderer.invoke("settings:getDarkMode") as Promise<boolean>,
    setDarkMode: (value: boolean) => ipcRenderer.invoke("settings:setDarkMode", value) as Promise<void>,
  },
  ai: {
    generateExamples: (id: string) => ipcRenderer.invoke("ai:generateExamples", id) as Promise<VocabEntryRow>,
    explainNuance: (id: string) => ipcRenderer.invoke("ai:explainNuance", id) as Promise<VocabEntryRow>,
    suggestRelatedWords: (id: string) => ipcRenderer.invoke("ai:suggestRelatedWords", id) as Promise<VocabEntryRow>,
    suggestTags: (id: string) => ipcRenderer.invoke("ai:suggestTags", id) as Promise<TagSuggestion>,
    quizQuestion: (id: string) => ipcRenderer.invoke("ai:quizQuestion", id) as Promise<QuizQuestion>,
    extractVocab: (paragraph: string) => ipcRenderer.invoke("ai:extractVocab", paragraph) as Promise<VocabCandidate[]>,
    // Preview variants: same Groq prompts, but work on raw text instead of
    // a saved vocabId and don't persist anything — used by the popup's AI
    // tabs before the word has been saved.
    previewExamples: (sourceText: string, meanings: string[]) =>
      ipcRenderer.invoke("ai:previewExamples", sourceText, meanings) as Promise<AiExample[]>,
    previewNuance: (sourceText: string, meanings: string[]) =>
      ipcRenderer.invoke("ai:previewNuance", sourceText, meanings) as Promise<string>,
    previewRelatedWords: (sourceText: string, sourceLang: string, targetText: string, targetLang: string) =>
      ipcRenderer.invoke(
        "ai:previewRelatedWords",
        sourceText,
        sourceLang,
        targetText,
        targetLang,
      ) as Promise<AiRelatedWords>,
    // Never persisted — works the same for a saved entry or a not-yet-saved
    // preview, so takes the word's info directly instead of a vocabId (see
    // WordChat.tsx, used from both VocabDetailModal and Popup.tsx).
    chatAboutWord: (
      sourceText: string,
      sourceLang: string,
      targetText: string,
      targetLang: string,
      meanings: string[],
      history: ChatMessage[],
    ) =>
      ipcRenderer.invoke(
        "ai:chatAboutWord",
        sourceText,
        sourceLang,
        targetText,
        targetLang,
        meanings,
        history,
      ) as Promise<string>,
  },
  popup: {
    resize: (size: { width: number; height: number }) => ipcRenderer.send("popup:resize", size),
    hide: () => ipcRenderer.send("popup:hide"),
  },
  app: {
    getVersion: () => ipcRenderer.invoke("app:getVersion") as Promise<string>,
  },
  log: {
    // Backfill — call once on mount, before subscribing to onEntry, so
    // nothing logged before the Logs panel opened is missed.
    getHistory: () => ipcRenderer.invoke("log:history") as Promise<LogEntry[]>,
    onEntry: (callback: (entry: LogEntry) => void) => {
      ipcRenderer.on("log:entry", (_event, entry: LogEntry) => callback(entry));
    },
  },
  updater: {
    checkNow: () => ipcRenderer.invoke("updater:checkNow") as Promise<void>,
    quitAndInstall: () => ipcRenderer.invoke("updater:quitAndInstall") as Promise<void>,
  },
  onTranslationResult: (callback: (payload: TranslationResultPayload) => void) => {
    ipcRenderer.on("translation:result", (_event, payload: TranslationResultPayload) => callback(payload));
  },
  // Selection-lookup hotkey with auto-save off (see Settings) — same shape
  // as vocab.preview's result, just pushed instead of returned, since the
  // popup (not the main window) initiates this lookup.
  onTranslationPreview: (callback: (payload: VocabPreview) => void) => {
    ipcRenderer.on("translation:preview", (_event, payload: VocabPreview) => callback(payload));
  },
  onOpenSearchPopup: (callback: () => void) => {
    ipcRenderer.on("popup:openSearch", () => callback());
  },
  onVocabCreated: (callback: (entry: VocabEntryRow) => void) => {
    ipcRenderer.on("vocab:created", (_event, entry: VocabEntryRow) => callback(entry));
  },
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    ipcRenderer.on("updater:status", (_event, status: UpdateStatus) => callback(status));
  },
  // Broadcast to every open window the instant Settings flips dark mode
  // (see ipc/handlers.ts's settings:setDarkMode) — lets main.tsx re-apply
  // the theme live instead of needing that window reopened.
  onThemeChanged: (callback: (dark: boolean) => void) => {
    ipcRenderer.on("theme:changed", (_event, dark: boolean) => callback(dark));
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ReckonApi = typeof api;
