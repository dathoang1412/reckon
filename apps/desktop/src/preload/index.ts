import { contextBridge, ipcRenderer } from "electron";

export interface VocabEntryRow {
  id: string;
  sourceText: string;
  sourceLang: string;
  targetText: string;
  targetLang: string;
}

export interface DueEntryRow extends VocabEntryRow {
  dueAt: string | null;
}

const api = {
  vocab: {
    list: () => ipcRenderer.invoke("vocab:list") as Promise<VocabEntryRow[]>,
    lookup: (text: string) => ipcRenderer.invoke("vocab:lookup", text) as Promise<VocabEntryRow>,
    delete: (id: string) => ipcRenderer.invoke("vocab:delete", id) as Promise<VocabEntryRow>,
  },
  sync: {
    run: () => ipcRenderer.invoke("sync:run") as Promise<{ pushed: number; pulled: number }>,
  },
  review: {
    due: (limit?: number) => ipcRenderer.invoke("review:due", limit) as Promise<DueEntryRow[]>,
    rate: (vocabId: string, remembered: boolean) =>
      ipcRenderer.invoke("review:rate", vocabId, remembered) as Promise<void>,
  },
  onTranslationResult: (callback: (result: VocabEntryRow) => void) => {
    ipcRenderer.on("translation:result", (_event, result: VocabEntryRow) => callback(result));
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ReckonApi = typeof api;
