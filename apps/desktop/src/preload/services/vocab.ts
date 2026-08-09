import { ipcRenderer } from "electron";
import type {
  DictionaryInfo,
  TranslationResultData,
  VocabEntryPatch,
  VocabEntryRow,
  VocabPreview,
  VocabSetRow,
} from "../types";

export const vocab = {
  list: () => ipcRenderer.invoke("vocab:list") as Promise<VocabEntryRow[]>,
  preview: (text: string) => ipcRenderer.invoke("vocab:preview", text) as Promise<VocabPreview>,
  save: (result: TranslationResultData) => ipcRenderer.invoke("vocab:save", result) as Promise<VocabEntryRow>,
  delete: (id: string) => ipcRenderer.invoke("vocab:delete", id) as Promise<VocabEntryRow>,
  setSet: (id: string, setId: string | null) =>
    ipcRenderer.invoke("vocab:setSet", id, setId) as Promise<VocabEntryRow>,
  update: (id: string, patch: VocabEntryPatch) =>
    ipcRenderer.invoke("vocab:update", id, patch) as Promise<VocabEntryRow>,
};

export const vocabSet = {
  list: () => ipcRenderer.invoke("vocabSet:list") as Promise<VocabSetRow[]>,
  create: (name: string) => ipcRenderer.invoke("vocabSet:create", name) as Promise<VocabSetRow>,
  rename: (id: string, name: string) => ipcRenderer.invoke("vocabSet:rename", id, name) as Promise<VocabSetRow>,
  delete: (id: string) => ipcRenderer.invoke("vocabSet:delete", id) as Promise<VocabSetRow>,
};

export const dictionary = {
  lookup: (word: string) => ipcRenderer.invoke("dictionary:lookup", word) as Promise<DictionaryInfo | null>,
};
