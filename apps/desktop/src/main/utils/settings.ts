import Store from "electron-store";

export const DEFAULT_HOTKEY = "CommandOrControl+Shift+D";
// Distinct from DEFAULT_HOTKEY (which looks up whatever's selected) — this
// one opens an empty popup for the user to type a word into, so it needs
// its own binding rather than overloading the same accelerator.
export const DEFAULT_SEARCH_HOTKEY = "CommandOrControl+Shift+F";

// "auto" lets translate.ts guess from the text itself (Vietnamese diacritics
// present -> vi->en, else en->vi) — the other two force a direction, for
// when a diacritic-less Vietnamese word or an ambiguous word would
// otherwise get misdetected. See TranslateDirectionToggle.tsx (the popup
// search box and App.tsx's lookup box both surface this, not a dedicated
// Settings section — it's a per-lookup mode, not a one-time preference).
export type TranslateDirection = "auto" | "en-vi" | "vi-en";

interface SettingsSchema {
  hotkey: string;
  searchHotkey: string;
  // Plaintext on disk, same as authSession.ts's stored token — no
  // OS-keychain wrapper exists anywhere in this codebase yet. Each user
  // supplies their own key (see Settings.tsx); it's never bundled into the
  // packaged app.
  groqApiKey: string;
  // Whether the selection-lookup hotkey saves a word immediately (true,
  // the original/default behavior) or just previews it with a manual Save
  // button in the popup, same as the empty-search-popup hotkey already
  // works — see app/hotkey.ts and windows/popup.ts.
  autoSave: boolean;
  translateDirection: TranslateDirection;
  // How many due cards Review.tsx pulls per session — null means no cap
  // ("ôn hết của ngày đó", review everything currently due) instead of
  // stopping after a fixed count. See services/review.ts's listDueEntries.
  reviewLimit: number | null;
  // See renderer/src/theme.ts's getThemeConfig and index.html's CSS vars —
  // this is the one source of truth every window (main + popup) reads on
  // boot and gets pushed a live update for for whenever Settings changes it
  // (see ipc/handlers.ts's "theme:changed" broadcast).
  darkMode: boolean;
}

// Lazy like getPrisma()/getDeviceId() in this file's siblings — Store reads
// app.getPath("userData"), which depends on app.setName() having already
// run, and that only happens once index.ts's top-level code executes (after
// this module's imports are evaluated).
let store: Store<SettingsSchema> | null = null;

function getStore(): Store<SettingsSchema> {
  if (!store) {
    store = new Store<SettingsSchema>({
      defaults: {
        hotkey: DEFAULT_HOTKEY,
        searchHotkey: DEFAULT_SEARCH_HOTKEY,
        groqApiKey: "",
        autoSave: true,
        translateDirection: "auto",
        reviewLimit: 20,
        darkMode: false,
      },
    });
  }
  return store;
}

export function getHotkey(): string {
  return getStore().get("hotkey");
}

export function setHotkey(accelerator: string): void {
  getStore().set("hotkey", accelerator);
}

export function getSearchHotkey(): string {
  return getStore().get("searchHotkey");
}

export function setSearchHotkey(accelerator: string): void {
  getStore().set("searchHotkey", accelerator);
}

export function getGroqApiKey(): string {
  return getStore().get("groqApiKey");
}

export function setGroqApiKey(key: string): void {
  getStore().set("groqApiKey", key);
}

export function getAutoSave(): boolean {
  return getStore().get("autoSave");
}

export function setAutoSave(value: boolean): void {
  getStore().set("autoSave", value);
}

export function getTranslateDirection(): TranslateDirection {
  return getStore().get("translateDirection");
}

export function setTranslateDirection(value: TranslateDirection): void {
  getStore().set("translateDirection", value);
}

export function getReviewLimit(): number | null {
  return getStore().get("reviewLimit");
}

export function setReviewLimit(value: number | null): void {
  getStore().set("reviewLimit", value);
}

export function getDarkMode(): boolean {
  return getStore().get("darkMode");
}

export function setDarkMode(value: boolean): void {
  getStore().set("darkMode", value);
}
