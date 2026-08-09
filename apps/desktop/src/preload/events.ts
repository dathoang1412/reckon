import { ipcRenderer } from "electron";
import type { GrammarCheckResult, TranslationResultPayload, UpdateStatus, VocabEntryRow, VocabPreview } from "./types";

export const events = {
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
  // Grammar hotkey (Ctrl+Shift+G by default) finished checking the
  // selected sentence — pushed the same way onTranslationResult/Preview
  // are, since it's the popup window (not the main window) that initiates
  // via a global hotkey rather than a renderer-side call.
  onGrammarResult: (callback: (result: GrammarCheckResult) => void) => {
    ipcRenderer.on("grammar:result", (_event, result: GrammarCheckResult) => callback(result));
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
