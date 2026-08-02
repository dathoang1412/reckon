import { app, BrowserWindow, globalShortcut, Menu, nativeImage, screen, shell, Tray } from "electron";
import path from "node:path";
import { registerIpcHandlers } from "./ipc";
import { getPrisma } from "./db";
import { getDeviceId } from "./deviceId";
import { runMigrations } from "./migrate";
import { readSelectedText } from "./selection";
import { getHotkey } from "./settings";
import { startServer, stopServer, waitForServerReady } from "./server";
import { lookupAndSaveVocab } from "./vocab";
import { showPopup } from "./popup";
import { createSplashWindow, closeSplashWindow } from "./splash";
import { TRAY_ICON_DATA_URL } from "./icon";

// Keep userData (and thus the SQLite file path) stable across dev/packaged
// runs instead of depending on Electron's inferred name from package.json.
app.setName("reckon");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let currentHotkey: string | null = null;

async function onHotkeyTriggered(): Promise<void> {
  // Captured before the async selection/translate/DB round-trip so the
  // popup lands where the user's selection was, not wherever the cursor
  // has drifted to by the time the lookup finishes.
  const cursorPosition = screen.getCursorScreenPoint();

  const text = await readSelectedText();
  if (!text) return;
  try {
    const entry = await lookupAndSaveVocab(getPrisma(), getDeviceId(), text);
    showPopup(entry, cursorPosition);
    // Keep the main window's list live if it's open (or just hidden in
    // the tray) instead of only refreshing on next manual reload.
    mainWindow?.webContents.send("vocab:created", entry);
  } catch (err) {
    console.error("[hotkey] lookup failed:", err);
  }
}

// Reused both at startup and whenever the settings page registers a new
// accelerator. Falls back to re-registering the previous binding if the
// requested one is already claimed at the OS level, so the app never ends
// up with no working hotkey at all.
function registerHotkey(accelerator: string): boolean {
  const previous = currentHotkey;
  if (previous) globalShortcut.unregister(previous);

  const ok = globalShortcut.register(accelerator, onHotkeyTriggered);
  if (ok) {
    currentHotkey = accelerator;
  } else {
    console.error(
      `[hotkey] Failed to register ${accelerator} — another running app has probably already claimed it at the OS level.`,
    );
    if (previous) globalShortcut.register(previous, onHotkeyTriggered);
  }
  return ok;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  // Avoids a flash of an empty window while the page loads; also lets the
  // startup sequence swap the splash screen out for this window at the
  // moment it actually has something to show.
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // Hide instead of quitting so the app keeps running in the tray.
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  if (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function createTray(): void {
  tray = new Tray(nativeImage.createFromDataURL(TRAY_ICON_DATA_URL));
  tray.setToolTip("Reckon");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show", click: () => mainWindow?.show() },
      { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
    ]),
  );
  tray.on("click", () => {
    if (mainWindow?.isVisible()) mainWindow.hide();
    else mainWindow?.show();
  });
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
      console.error("[startup] sync backend not ready yet:", err);
    }

    registerIpcHandlers({ registerHotkey });
    createWindow();
    mainWindow?.once("ready-to-show", () => closeSplashWindow());
    createTray();

    registerHotkey(getHotkey());

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
