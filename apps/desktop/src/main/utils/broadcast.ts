import { BrowserWindow } from "electron";

// Pushes to every open window (main + popup, whichever happen to be open at
// the moment) — same shape as the settings:setDarkMode / log.ts broadcasts,
// pulled out here since vocab CRUD needs it from four call sites
// (handlers.ts's save/update/delete/setSet) plus hotkey.ts's auto-save path.
export function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}
