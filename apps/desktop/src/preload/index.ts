import { contextBridge, ipcRenderer } from "electron";

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

const api = {
  vocab: {
    list: () => ipcRenderer.invoke("vocab:list") as Promise<VocabEntryRow[]>,
    preview: (text: string) => ipcRenderer.invoke("vocab:preview", text) as Promise<VocabPreview>,
    save: (result: TranslationResultData) => ipcRenderer.invoke("vocab:save", result) as Promise<VocabEntryRow>,
    delete: (id: string) => ipcRenderer.invoke("vocab:delete", id) as Promise<VocabEntryRow>,
    setSet: (id: string, setId: string | null) =>
      ipcRenderer.invoke("vocab:setSet", id, setId) as Promise<VocabEntryRow>,
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
  review: {
    due: (limit?: number) => ipcRenderer.invoke("review:due", limit) as Promise<DueEntryRow[]>,
    rate: (vocabId: string, remembered: boolean) =>
      ipcRenderer.invoke("review:rate", vocabId, remembered) as Promise<void>,
  },
  settings: {
    getHotkey: () => ipcRenderer.invoke("settings:getHotkey") as Promise<string>,
    setHotkey: (accelerator: string) => ipcRenderer.invoke("settings:setHotkey", accelerator) as Promise<boolean>,
  },
  popup: {
    resize: (size: { width: number; height: number }) => ipcRenderer.send("popup:resize", size),
  },
  onTranslationResult: (callback: (payload: TranslationResultPayload) => void) => {
    ipcRenderer.on("translation:result", (_event, payload: TranslationResultPayload) => callback(payload));
  },
  onVocabCreated: (callback: (entry: VocabEntryRow) => void) => {
    ipcRenderer.on("vocab:created", (_event, entry: VocabEntryRow) => callback(entry));
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ReckonApi = typeof api;
