import { contextBridge, ipcRenderer } from "electron";

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
  mnemonic: string | null;
  aiExamples: AiExample[];
  aiNuance: string | null;
  aiRelatedWords: AiRelatedWords | null;
}

export interface VocabEntryPatch {
  note?: string | null;
  tags?: string[];
  definition?: string | null;
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
    logout: () => ipcRenderer.invoke("auth:logout") as Promise<void>,
    getSession: () => ipcRenderer.invoke("auth:getSession") as Promise<AuthSession | null>,
  },
  review: {
    due: (limit?: number, setId?: string | null) =>
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
  },
  ai: {
    generateExamples: (id: string) => ipcRenderer.invoke("ai:generateExamples", id) as Promise<VocabEntryRow>,
    explainNuance: (id: string) => ipcRenderer.invoke("ai:explainNuance", id) as Promise<VocabEntryRow>,
    suggestRelatedWords: (id: string) => ipcRenderer.invoke("ai:suggestRelatedWords", id) as Promise<VocabEntryRow>,
    generateMnemonic: (id: string) => ipcRenderer.invoke("ai:generateMnemonic", id) as Promise<VocabEntryRow>,
    suggestTags: (id: string) => ipcRenderer.invoke("ai:suggestTags", id) as Promise<TagSuggestion>,
    quizQuestion: (id: string) => ipcRenderer.invoke("ai:quizQuestion", id) as Promise<QuizQuestion>,
    extractVocab: (paragraph: string) => ipcRenderer.invoke("ai:extractVocab", paragraph) as Promise<VocabCandidate[]>,
  },
  popup: {
    resize: (size: { width: number; height: number }) => ipcRenderer.send("popup:resize", size),
    hide: () => ipcRenderer.send("popup:hide"),
  },
  app: {
    getVersion: () => ipcRenderer.invoke("app:getVersion") as Promise<string>,
  },
  updater: {
    checkNow: () => ipcRenderer.invoke("updater:checkNow") as Promise<void>,
    quitAndInstall: () => ipcRenderer.invoke("updater:quitAndInstall") as Promise<void>,
  },
  onTranslationResult: (callback: (payload: TranslationResultPayload) => void) => {
    ipcRenderer.on("translation:result", (_event, payload: TranslationResultPayload) => callback(payload));
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
};

contextBridge.exposeInMainWorld("api", api);

export type ReckonApi = typeof api;
