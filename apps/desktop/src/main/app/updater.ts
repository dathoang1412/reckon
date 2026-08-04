import { app, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

export type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };

export interface Updater {
  checkNow: () => void;
  quitAndInstall: () => void;
}

const NOOP_UPDATER: Updater = { checkNow: () => {}, quitAndInstall: () => {} };

// Wires electron-updater to the public GitHub Releases feed configured in
// electron-builder.yml (publish.provider: github) — unauthenticated
// requests against latest.yml, so this only resolves updates while that
// repo stays public. Every status change is pushed to whichever window is
// currently open (see preload's onUpdateStatus) so Settings.tsx can show
// it without polling. Only registers listeners — callers trigger the
// startup check explicitly (see index.ts) once the app is actually ready,
// mirroring how hotkeyManager.register() is called separately from its
// construction.
export function createUpdater(getMainWindow: () => BrowserWindow | null): Updater {
  // electron-updater reads app-update.yml, which electron-builder only
  // writes into packaged builds — running this in dev would just log
  // noisy "Cannot find" errors for a check that could never succeed anyway
  // (a dev build has no meaningful version to compare).
  if (!app.isPackaged) return NOOP_UPDATER;

  function broadcast(status: UpdateStatus): void {
    getMainWindow()?.webContents.send("updater:status", status);
  }

  autoUpdater.on("checking-for-update", () => broadcast({ state: "checking" }));
  autoUpdater.on("update-available", (info) => broadcast({ state: "available", version: info.version }));
  autoUpdater.on("update-not-available", () => broadcast({ state: "not-available" }));
  autoUpdater.on("download-progress", (progress) =>
    broadcast({ state: "downloading", percent: Math.round(progress.percent) }),
  );
  autoUpdater.on("update-downloaded", (info) => broadcast({ state: "downloaded", version: info.version }));
  autoUpdater.on("error", (err) => broadcast({ state: "error", message: err.message }));

  function checkNow(): void {
    // Swallowed here (not just left to the 'error' event) so a check
    // triggered before any window exists yet can't produce an unhandled
    // rejection — the 'error' listener above still fires and reports it
    // once a window is around to show it.
    autoUpdater.checkForUpdates().catch(() => {});
  }

  return { checkNow, quitAndInstall: () => autoUpdater.quitAndInstall() };
}
