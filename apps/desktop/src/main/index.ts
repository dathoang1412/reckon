import { app, BrowserWindow, globalShortcut, type Tray } from "electron";
import { createHotkeyManager, createSearchHotkeyManager } from "./app/hotkey";
import { createUpdater } from "./app/updater";
import { getPrisma } from "./db/client";
import { runMigrations } from "./db/migrate";
import { registerIpcHandlers } from "./ipc/handlers";
import { logError } from "./services/log";
import { startServer, stopServer, waitForServerReady } from "./services/server";
import { getHotkey, getSearchHotkey } from "./utils/settings";
import { createMainWindow } from "./windows/mainWindow";
import { closeSplashWindow, createSplashWindow } from "./windows/splash";
import { createTray } from "./windows/tray";

// Keep userData (and thus the SQLite file path) stable across dev/packaged
// runs instead of depending on Electron's inferred name from package.json.
app.setName("reckon");

let mainWindow: BrowserWindow | null = null;
// Referenced only to keep it alive — Electron garbage-collects a Tray (and
// its icon disappears) the moment nothing holds onto it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- write-only on purpose, see above
let trayRef: Tray | null = null;
let isQuitting = false;

const hotkeyManager = createHotkeyManager(() => mainWindow);
const searchHotkeyManager = createSearchHotkeyManager();
const updater = createUpdater(() => mainWindow);

function openMainWindow(): void {
  mainWindow = createMainWindow(() => !isQuitting);
}

// A second launch would otherwise spawn its own sync-backend child on the
// same fixed port as the first, lose that port race, and leave that
// window's sync permanently broken. Hand off to the existing instance
// instead of starting a competing one — gating everything below behind the
// lock (rather than just calling app.quit()) stops this instance from ever
// calling startServer() in the first place.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    createSplashWindow();

    const prisma = getPrisma();

    // Must finish before any handler can touch the database — packaged
    // builds have no `prisma migrate deploy` CLI available, so this is
    // the only place schema changes get applied on a user's machine.
    await runMigrations(prisma);

    startServer();
    try {
      // Bounded (see waitForServerReady) — a slow first boot delays the
      // splash a bit longer but never hangs it; sync itself still awaits
      // readiness independently on top of this, so a timeout here just
      // means the main window opens before the backend caught up instead
      // of blocking startup on it.
      await waitForServerReady();
    } catch (err) {
      logError("app", `[startup] sync backend not ready yet: ${err instanceof Error ? err.message : String(err)}`);
    }

    registerIpcHandlers({
      registerHotkey: (accelerator) => hotkeyManager.register(accelerator),
      registerSearchHotkey: (accelerator) => searchHotkeyManager.register(accelerator),
      getMainWindow: () => mainWindow,
      checkForUpdates: () => updater.checkNow(),
      quitAndInstallUpdate: () => updater.quitAndInstall(),
    });
    openMainWindow();
    mainWindow?.once("ready-to-show", () => closeSplashWindow());
    trayRef = createTray({
      getMainWindow: () => mainWindow,
      quit: () => {
        isQuitting = true;
        app.quit();
      },
    });

    hotkeyManager.register(getHotkey());
    searchHotkeyManager.register(getSearchHotkey());
    // Fire-and-forget — a slow/offline check shouldn't delay anything else
    // startup does, and any result (available/not/error) just gets pushed
    // to the main window whenever it's ready to show it.
    updater.checkNow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) openMainWindow();
    });
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    stopServer();
  });

  app.on("window-all-closed", () => {
    // Intentionally a no-op: the tray keeps the app alive on Windows/Linux
    // even with no visible windows. Quitting happens via the tray's Quit
    // action, which sets isQuitting before calling app.quit().
  });
}
