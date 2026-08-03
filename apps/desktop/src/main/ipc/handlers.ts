import { ipcMain } from "electron";
import { getPrisma } from "../db/client";
import { getDeviceId } from "../utils/deviceId";
import { lookupEnglishWord } from "../services/dictionary";
import { listDueEntries, rateReview } from "../services/review";
import { getHotkey, setHotkey } from "../utils/settings";
import { runSync } from "../services/sync";
import { synthesizeSpeech } from "../services/tts";
import type { TranslationResult } from "../services/translate";
import {
  deleteVocabEntry,
  listVocabEntries,
  parseTargetMeanings,
  previewVocab,
  saveVocab,
  setVocabEntrySet,
} from "../services/vocab";
import { createVocabSet, deleteVocabSet, listVocabSets, renameVocabSet } from "../services/vocabSet";

interface IpcHandlerDeps {
  // Actually (re-)registers the OS-level global shortcut — kept in the
  // hotkey manager (see app/hotkey.ts), since that's where the handler
  // triggered by the hotkey lives.
  registerHotkey: (accelerator: string) => boolean;
}

// Prisma stores targetMeanings as a JSON string column, and createdAt as a
// Date; the renderer works with the parsed string[] shape and an ISO string
// (see preload's VocabEntryRow) so it doesn't need to deal with structured
// clone semantics for dates crossing the IPC boundary.
function toVocabEntryRow<T extends { targetText: string; targetMeanings: string | null; createdAt: Date }>(
  entry: T,
): Omit<T, "targetMeanings" | "createdAt"> & { targetMeanings: string[]; createdAt: string } {
  return { ...entry, targetMeanings: parseTargetMeanings(entry), createdAt: entry.createdAt.toISOString() };
}

export function registerIpcHandlers({ registerHotkey }: IpcHandlerDeps): void {
  const prisma = getPrisma();
  const deviceId = getDeviceId();

  ipcMain.handle("vocab:list", async () => {
    const entries = await listVocabEntries(prisma);
    return entries.map(toVocabEntryRow);
  });

  ipcMain.handle("vocab:preview", async (_event, text: string) => {
    return previewVocab(text);
  });

  ipcMain.handle("vocab:save", async (_event, result: TranslationResult) => {
    return toVocabEntryRow(await saveVocab(prisma, deviceId, result));
  });

  ipcMain.handle("vocab:delete", async (_event, id: string) => {
    return toVocabEntryRow(await deleteVocabEntry(prisma, deviceId, id));
  });

  ipcMain.handle("vocab:setSet", async (_event, id: string, setId: string | null) => {
    return toVocabEntryRow(await setVocabEntrySet(prisma, deviceId, id, setId));
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

  ipcMain.handle("tts:speak", async (_event, text: string, lang: string) => {
    const audio = await synthesizeSpeech(text, lang);
    return audio.toString("base64");
  });

  ipcMain.handle("sync:run", async () => {
    return runSync(prisma, deviceId);
  });

  ipcMain.handle("review:due", async (_event, limit?: number) => {
    const entries = await listDueEntries(prisma, limit);
    return entries.map(toVocabEntryRow);
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
