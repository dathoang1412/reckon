import { app, ipcMain } from "electron";
import type { UpdateProfileRequest } from "@reckon/shared";
import { getPrisma } from "../db/client";
import { broadcast } from "../utils/broadcast";
import { getDeviceId } from "../utils/deviceId";
import {
  chatAboutWord,
  checkGrammar,
  extractVocabCandidates,
  explainNuance,
  generateExamples,
  generateQuizQuestion,
  previewDefinition,
  previewExamples,
  previewNuance,
  previewRelatedWords,
  suggestRelatedWords,
  suggestTags,
  type ChatMessage,
} from "../services/ai/ai";
import { getProfile, login, loginWithGoogle, signup, updateProfile } from "../services/auth/auth";
import { clearSession, getSession } from "../utils/authSession";
import { lookupEnglishWord } from "../services/vocab/dictionary";
import { searchImages } from "../services/vocab/image";
import { chatJSON } from "../services/ai/groq";
import { getLogHistory } from "../services/system/log";
import { listDueEntries, rateReview } from "../services/review/review";
import {
  getAutoSave,
  getDarkMode,
  getGrammarHotkey,
  getGroqApiKey,
  getHotkey,
  getReviewLimit,
  getSearchHotkey,
  getTranslateDirection,
  setAutoSave,
  setDarkMode,
  setGrammarHotkey,
  setGroqApiKey,
  setHotkey,
  setReviewLimit,
  setSearchHotkey,
  setTranslateDirection,
  type TranslateDirection,
} from "../utils/settings";
import { runSync } from "../services/system/sync";
import { synthesizeSpeech } from "../services/system/tts";
import type { TranslationResult } from "../services/vocab/translate";
import {
  deleteVocabEntry,
  listVocabEntries,
  previewVocab,
  saveVocab,
  setVocabEntrySet,
  toVocabEntryRow,
  updateVocabEntry,
  type VocabEntryPatch,
} from "../services/vocab/vocab";
import { createVocabSet, deleteVocabSet, listVocabSets, renameVocabSet } from "../services/vocab/vocabSet";

interface IpcHandlerDeps {
  // Actually (re-)registers the OS-level global shortcut — kept in the
  // hotkey manager (see app/hotkey.ts), since that's where the handler
  // triggered by the hotkey lives.
  registerHotkey: (accelerator: string) => boolean;
  // Same, for the second (empty search popup) hotkey.
  registerSearchHotkey: (accelerator: string) => boolean;
  // Same, for the third (grammar/naturalness check) hotkey.
  registerGrammarHotkey: (accelerator: string) => boolean;
  // Both delegate to the updater instance created in index.ts (see
  // app/updater.ts) — kept there, not here, since that's also where its
  // event listeners live.
  checkForUpdates: () => void;
  quitAndInstallUpdate: () => void;
}

export function registerIpcHandlers({
  registerHotkey,
  registerSearchHotkey,
  registerGrammarHotkey,
  checkForUpdates,
  quitAndInstallUpdate,
}: IpcHandlerDeps): void {
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
    // Broadcast to every open window (not just the main one) so the popup's
    // browse tab (see Popup.tsx) and any other open window's list stay live
    // instead of only refreshing once that window is reopened — this
    // included receiving its own broadcast back when the save originated
    // from that same window, which is a harmless no-op dedupe (see
    // onVocabCreated in both App.tsx and Popup.tsx).
    broadcast("vocab:created", entry);
    return entry;
  });

  ipcMain.handle("vocab:delete", async (_event, id: string) => {
    const entry = toVocabEntryRow(await deleteVocabEntry(prisma, deviceId, id));
    broadcast("vocab:deleted", entry);
    return entry;
  });

  ipcMain.handle("vocab:setSet", async (_event, id: string, setId: string | null) => {
    const entry = toVocabEntryRow(await setVocabEntrySet(prisma, deviceId, id, setId));
    broadcast("vocab:updated", entry);
    return entry;
  });

  ipcMain.handle("vocab:update", async (_event, id: string, patch: VocabEntryPatch) => {
    const entry = toVocabEntryRow(await updateVocabEntry(prisma, deviceId, id, patch));
    broadcast("vocab:updated", entry);
    return entry;
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

  // from/to (ISO date strings): when set, review by a specific saved date
  // instead of by what's due — see Review.tsx's date filter and
  // listDueEntries's dateRange param for the bypass-the-due-gate behavior.
  ipcMain.handle(
    "review:due",
    async (_event, limit?: number | null, setId?: string | null, from?: string, to?: string) => {
      const dateRange = from || to ? { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined } : undefined;
      const entries = await listDueEntries(prisma, limit, setId, dateRange);
      return entries.map(toVocabEntryRow);
    },
  );

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

  ipcMain.handle("auth:loginWithGoogle", async () => {
    const { email } = await loginWithGoogle();
    return { email };
  });

  ipcMain.handle("auth:logout", () => {
    clearSession();
  });

  ipcMain.handle("auth:getSession", () => {
    const session = getSession();
    return session ? { email: session.email } : null;
  });

  ipcMain.handle("auth:getProfile", () => getProfile());

  ipcMain.handle("auth:updateProfile", (_event, patch: UpdateProfileRequest) => updateProfile(patch));

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

  ipcMain.handle("settings:getGrammarHotkey", () => getGrammarHotkey());

  ipcMain.handle("settings:setGrammarHotkey", (_event, accelerator: string) => {
    const ok = registerGrammarHotkey(accelerator);
    if (ok) setGrammarHotkey(accelerator);
    return ok;
  });

  ipcMain.handle("settings:getGroqApiKey", () => getGroqApiKey());

  ipcMain.handle("settings:setGroqApiKey", (_event, key: string) => {
    setGroqApiKey(key);
  });

  ipcMain.handle("settings:hasGroqApiKey", () => !!getGroqApiKey());

  // Validates a just-typed (maybe-not-yet-saved) key, bypassing the store
  // via apiKeyOverride — that's why this takes a key argument instead of
  // just reading settings itself.
  ipcMain.handle("settings:testGroqApiKey", async (_event, key: string) => {
    // The literal word "json" has to appear somewhere in the messages —
    // Groq (like OpenAI) rejects response_format: json_object with a 400
    // otherwise, regardless of whether the content already looks like JSON.
    await chatJSON({
      system: 'Trả lời bằng JSON chính xác: {"ok":true}',
      user: "ping",
      maxTokens: 20,
      apiKeyOverride: key,
    });
  });

  // Illustration search for a vocab word (see image.ts) — preview-only,
  // nothing here touches Prisma; the picked result is written into
  // VocabEntry.imageUrl via the existing vocab:update patch, same as
  // ai:previewDefinition feeds into the `definition` column. No API key —
  // Wikipedia's search API is open, so there's nothing to configure/gate.
  ipcMain.handle("images:search", async (_event, query: string) => {
    return searchImages(query);
  });

  ipcMain.handle("ai:generateExamples", async (_event, id: string) => {
    return toVocabEntryRow(await generateExamples(prisma, deviceId, id));
  });

  ipcMain.handle("ai:explainNuance", async (_event, id: string) => {
    return toVocabEntryRow(await explainNuance(prisma, deviceId, id));
  });

  ipcMain.handle("ai:suggestRelatedWords", async (_event, id: string) => {
    return toVocabEntryRow(await suggestRelatedWords(prisma, deviceId, id));
  });

  ipcMain.handle("ai:suggestTags", async (_event, id: string) => {
    return suggestTags(prisma, id);
  });

  ipcMain.handle("ai:quizQuestion", async (_event, id: string) => {
    return generateQuizQuestion(prisma, id);
  });

  ipcMain.handle("ai:extractVocab", async (_event, paragraph: string) => {
    return extractVocabCandidates(paragraph);
  });

  // Preview variants: same Groq prompts as the persisted ai:* handlers
  // above, but operate on raw text instead of a saved vocabId and don't
  // touch the database — used by the popup's AI tabs so they work before
  // the word has been saved (see Popup.tsx). `definition`, when passed, is
  // whichever of the dictionary/AI definitions the user picked (see
  // DefinitionChooser.tsx) — grounds generation in that specific sense.
  ipcMain.handle(
    "ai:previewExamples",
    async (_event, sourceText: string, meanings: string[], definition?: string | null) => {
      return previewExamples(sourceText, meanings, definition);
    },
  );

  ipcMain.handle(
    "ai:previewNuance",
    async (_event, sourceText: string, meanings: string[], definition?: string | null) => {
      return previewNuance(sourceText, meanings, definition);
    },
  );

  ipcMain.handle(
    "ai:previewRelatedWords",
    async (
      _event,
      sourceText: string,
      sourceLang: string,
      targetText: string,
      targetLang: string,
      definition?: string | null,
    ) => {
      return previewRelatedWords(sourceText, sourceLang, targetText, targetLang, definition);
    },
  );

  // AI-generated definition offered alongside the free-dictionary one right
  // after a lookup (see DefinitionChooser.tsx) — preview-only, same
  // reasoning as the other preview* handlers above.
  ipcMain.handle("ai:previewDefinition", async (_event, sourceText: string, meanings: string[]) => {
    return previewDefinition(sourceText, meanings);
  });

  // Never persisted (see ai.ts's chatAboutWord) — works the same whether
  // the word is saved or still just a preview, so no vocabId here either.
  ipcMain.handle(
    "ai:chatAboutWord",
    async (
      _event,
      sourceText: string,
      sourceLang: string,
      targetText: string,
      targetLang: string,
      meanings: string[],
      history: ChatMessage[],
    ) => {
      return chatAboutWord(sourceText, sourceLang, targetText, targetLang, meanings, history);
    },
  );

  // Ctrl+Shift+G on selected text (see app/hotkey.ts) — also invocable
  // directly from a renderer (not just the global hotkey path) since it
  // takes raw text rather than anything OS-selection-specific.
  ipcMain.handle("ai:checkGrammar", async (_event, sentence: string) => {
    return checkGrammar(sentence);
  });

  ipcMain.handle("settings:getAutoSave", () => getAutoSave());

  ipcMain.handle("settings:setAutoSave", (_event, value: boolean) => {
    setAutoSave(value);
  });

  ipcMain.handle("settings:getTranslateDirection", () => getTranslateDirection());

  ipcMain.handle("settings:setTranslateDirection", (_event, value: TranslateDirection) => {
    setTranslateDirection(value);
  });

  ipcMain.handle("settings:getReviewLimit", () => getReviewLimit());

  ipcMain.handle("settings:setReviewLimit", (_event, value: number | null) => {
    setReviewLimit(value);
  });

  ipcMain.handle("settings:getDarkMode", () => getDarkMode());

  // Pushed to every open window (main + popup, if it happens to be open at
  // the same time), not just the caller's own — so switching it in Settings
  // doesn't need either window reopened to take effect.
  ipcMain.handle("settings:setDarkMode", (_event, value: boolean) => {
    setDarkMode(value);
    broadcast("theme:changed", value);
  });

  ipcMain.handle("app:getVersion", () => app.getVersion());

  // Backfill for Settings' Logs panel (see LogViewer.tsx) — live entries
  // alone would miss anything logged before that panel mounted, which is
  // most of it (the sync backend boots well before any window is open).
  ipcMain.handle("log:history", () => getLogHistory());

  ipcMain.handle("updater:checkNow", () => {
    checkForUpdates();
  });

  ipcMain.handle("updater:quitAndInstall", () => {
    quitAndInstallUpdate();
  });
}
