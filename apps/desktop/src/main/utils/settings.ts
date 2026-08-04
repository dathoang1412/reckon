import Store from "electron-store";

export const DEFAULT_HOTKEY = "CommandOrControl+Shift+D";
// Distinct from DEFAULT_HOTKEY (which looks up whatever's selected) — this
// one opens an empty popup for the user to type a word into, so it needs
// its own binding rather than overloading the same accelerator.
export const DEFAULT_SEARCH_HOTKEY = "CommandOrControl+Shift+F";

interface SettingsSchema {
  hotkey: string;
  searchHotkey: string;
}

// Lazy like getPrisma()/getDeviceId() in this file's siblings — Store reads
// app.getPath("userData"), which depends on app.setName() having already
// run, and that only happens once index.ts's top-level code executes (after
// this module's imports are evaluated).
let store: Store<SettingsSchema> | null = null;

function getStore(): Store<SettingsSchema> {
  if (!store) {
    store = new Store<SettingsSchema>({ defaults: { hotkey: DEFAULT_HOTKEY, searchHotkey: DEFAULT_SEARCH_HOTKEY } });
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
