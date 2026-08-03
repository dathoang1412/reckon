import Store from "electron-store";

export const DEFAULT_HOTKEY = "CommandOrControl+Shift+D";

interface SettingsSchema {
  hotkey: string;
}

// Lazy like getPrisma()/getDeviceId() in this file's siblings — Store reads
// app.getPath("userData"), which depends on app.setName() having already
// run, and that only happens once index.ts's top-level code executes (after
// this module's imports are evaluated).
let store: Store<SettingsSchema> | null = null;

function getStore(): Store<SettingsSchema> {
  if (!store) {
    store = new Store<SettingsSchema>({ defaults: { hotkey: DEFAULT_HOTKEY } });
  }
  return store;
}

export function getHotkey(): string {
  return getStore().get("hotkey");
}

export function setHotkey(accelerator: string): void {
  getStore().set("hotkey", accelerator);
}
