import { type BrowserWindow, ipcMain } from "electron";
import { getPrisma } from "../db/client";
import { getDeviceId } from "../utils/deviceId";
import { login, signup } from "../services/auth";
import { clearSession, getSession } from "../utils/authSession";
import { lookupEnglishWord } from "../services/dictionary";
import { listDueEntries, rateReview } from "../services/review";
import { getHotkey, getSearchHotkey, setHotkey, setSearchHotkey } from "../utils/settings";
import { runSync } from "../services/sync";
import { synthesizeSpeech } from "../services/tts";
import type { TranslationResult } from "../services/translate";
import {
  deleteVocabEntry,
  listVocabEntries,
  parseTags,
  parseTargetMeanings,
  previewVocab,
  saveVocab,
  setVocabEntrySet,
  updateVocabEntry,
  type VocabEntryPatch,
} from "../services/vocab";
import { createVocabSet, deleteVocabSet, listVocabSets, renameVocabSet } from "../services/vocabSet";

interface IpcHandlerDeps {
  // Actually (re-)registers the OS-level global shortcut — kept in the
  // hotkey manager (see app/hotkey.ts), since that's where the handler
  // triggered by the hotkey lives.
  registerHotkey: (accelerator: string) => boolean;
  // Same, for the second (empty search popup) hotkey.
  registerSearchHotkey: (accelerator: string) => boolean;
  // Lets a save made from the search popup (a separate window/renderer)
  // push the new entry into the main window's list, the same way the
  // selection-lookup hotkey already does in app/hotkey.ts.
  getMainWindow: () => BrowserWindow | null;
}

// Prisma stores targetMeanings/tags as JSON string columns, and createdAt as
// a Date; the renderer works with the parsed string[] shapes and an ISO
// string (see preload's VocabEntryRow) so it doesn't need to deal with
// structured clone semantics for dates crossing the IPC boundary.
function toVocabEntryRow<
  T extends { targetText: string; targetMeanings: string | null; tags: string | null; createdAt: Date },
>(
  entry: T,
): Omit<T, "targetMeanings" | "tags" | "createdAt"> & { targetMeanings: string[]; tags: string[]; createdAt: string } {
  return {
    ...entry,
    targetMeanings: parseTargetMeanings(entry),
    tags: parseTags(entry),
    createdAt: entry.createdAt.toISOString(),
  };
}

export function registerIpcHandlers({ registerHotkey, registerSearchHotkey, getMainWindow }: IpcHandlerDeps): void {
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
    const entry = toVocabEntryRow(await saveVocab(prisma, deviceId, result));
    // Only meaningfully different from the caller's own state when the save
    // came from the search popup (a separate window) — the main window's
    // own save flow (App.tsx) already refreshes its list itself, and
    // onVocabCreated there dedupes by id, so this is a harmless no-op then.
    getMainWindow()?.webContents.send("vocab:created", entry);
    return entry;
  });

  ipcMain.handle("vocab:delete", async (_event, id: string) => {
    return toVocabEntryRow(await deleteVocabEntry(prisma, deviceId, id));
  });

  ipcMain.handle("vocab:setSet", async (_event, id: string, setId: string | null) => {
    return toVocabEntryRow(await setVocabEntrySet(prisma, deviceId, id, setId));
  });

  ipcMain.handle("vocab:update", async (_event, id: string, patch: VocabEntryPatch) => {
    return toVocabEntryRow(await updateVocabEntry(prisma, deviceId, id, patch));
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

  ipcMain.handle("review:due", async (_event, limit?: number, setId?: string | null) => {
    const entries = await listDueEntries(prisma, limit, setId);
    return entries.map(toVocabEntryRow);
  });

  ipcMain.handle("review:rate", async (_event, vocabId: string, remembered: boolean) => {
    await rateReview(prisma, vocabId, remembered);
  });

  ipcMain.handle("auth:signup", async (_event, email: string, password: string) => {
    const { email: signedUpEmail } = await signup(email, password);
    return { email: signedUpEmail };
  });

  ipcMain.handle("auth:login", async (_event, email: string, password: string) => {
    const { email: loggedInEmail } = await login(email, password);
    return { email: loggedInEmail };
  });

  ipcMain.handle("auth:logout", () => {
    clearSession();
  });

  ipcMain.handle("auth:getSession", () => {
    const session = getSession();
    return session ? { email: session.email } : null;
  });

  ipcMain.handle("settings:getHotkey", () => getHotkey());

  ipcMain.handle("settings:setHotkey", (_event, accelerator: string) => {
    const ok = registerHotkey(accelerator);
    if (ok) setHotkey(accelerator);
    return ok;
  });

  ipcMain.handle("settings:getSearchHotkey", () => getSearchHotkey());

  ipcMain.handle("settings:setSearchHotkey", (_event, accelerator: string) => {
    const ok = registerSearchHotkey(accelerator);
    if (ok) setSearchHotkey(accelerator);
    return ok;
  });
}
