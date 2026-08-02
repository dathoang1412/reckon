import { ipcMain } from "electron";
import { getPrisma } from "./db";
import { getDeviceId } from "./deviceId";
import { lookupEnglishWord } from "./dictionary";
import { listDueEntries, rateReview } from "./review";
import { getHotkey, setHotkey } from "./settings";
import { runSync } from "./sync";
import type { TranslationResult } from "./translate";
import { deleteVocabEntry, listVocabEntries, previewVocab, saveVocab, setVocabEntrySet } from "./vocab";
import { createVocabSet, deleteVocabSet, listVocabSets, renameVocabSet } from "./vocabSet";

interface IpcHandlerDeps {
  // Actually (re-)registers the OS-level global shortcut — kept in index.ts
  // since that's where the handler triggered by the hotkey lives.
  registerHotkey: (accelerator: string) => boolean;
}

export function registerIpcHandlers({ registerHotkey }: IpcHandlerDeps): void {
  const prisma = getPrisma();
  const deviceId = getDeviceId();

  ipcMain.handle("vocab:list", async () => {
    return listVocabEntries(prisma);
  });

  ipcMain.handle("vocab:preview", async (_event, text: string) => {
    return previewVocab(text);
  });

  ipcMain.handle("vocab:save", async (_event, result: TranslationResult) => {
    return saveVocab(prisma, deviceId, result);
  });

  ipcMain.handle("vocab:delete", async (_event, id: string) => {
    return deleteVocabEntry(prisma, deviceId, id);
  });

  ipcMain.handle("vocab:setSet", async (_event, id: string, setId: string | null) => {
    return setVocabEntrySet(prisma, deviceId, id, setId);
  });

  ipcMain.handle("vocabSet:list", async () => {
    return listVocabSets(prisma);
  });

  ipcMain.handle("vocabSet:create", async (_event, name: string) => {
    return createVocabSet(prisma, deviceId, name);
  });

  ipcMain.handle("vocabSet:rename", async (_event, id: string, name: string) => {
    return renameVocabSet(prisma, deviceId, id, name);
  });

  ipcMain.handle("vocabSet:delete", async (_event, id: string) => {
    return deleteVocabSet(prisma, deviceId, id);
  });

  ipcMain.handle("dictionary:lookup", async (_event, word: string) => {
    return lookupEnglishWord(word);
  });

  ipcMain.handle("sync:run", async () => {
    return runSync(prisma, deviceId);
  });

  ipcMain.handle("review:due", async (_event, limit?: number) => {
    return listDueEntries(prisma, limit);
  });

  ipcMain.handle("review:rate", async (_event, vocabId: string, remembered: boolean) => {
    await rateReview(prisma, vocabId, remembered);
  });

  ipcMain.handle("settings:getHotkey", () => getHotkey());

  ipcMain.handle("settings:setHotkey", (_event, accelerator: string) => {
    const ok = registerHotkey(accelerator);
    if (ok) setHotkey(accelerator);
    return ok;
  });
}
