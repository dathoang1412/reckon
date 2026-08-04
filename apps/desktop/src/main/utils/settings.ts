import Store from "electron-store";

export const DEFAULT_HOTKEY = "CommandOrControl+Shift+D";
// Distinct from DEFAULT_HOTKEY (which looks up whatever's selected) — this
// one opens an empty popup for the user to type a word into, so it needs
// its own binding rather than overloading the same accelerator.
export const DEFAULT_SEARCH_HOTKEY = "CommandOrControl+Shift+F";

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
}

// Lazy like getPrisma()/getDeviceId() in this file's siblings — Store reads
// app.getPath("userData"), which depends on app.setName() having already
// run, and that only happens once index.ts's top-level code executes (after
// this module's imports are evaluated).
let store: Store<SettingsSchema> | null = null;

function getStore(): Store<SettingsSchema> {
  if (!store) {
    store = new Store<SettingsSchema>({
      defaults: { hotkey: DEFAULT_HOTKEY, searchHotkey: DEFAULT_SEARCH_HOTKEY, groqApiKey: "", autoSave: true },
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
