import { app, BrowserWindow, globalShortcut, Menu, nativeImage, shell, Tray } from "electron";
import path from "node:path";
import { registerIpcHandlers } from "./ipc";
import { getPrisma } from "./db";
import { getDeviceId } from "./deviceId";
import { runMigrations } from "./migrate";
import { readSelectedText } from "./selection";
import { lookupAndSaveVocab } from "./vocab";
import { showPopup } from "./popup";
import { TRAY_ICON_DATA_URL } from "./icon";

// Keep userData (and thus the SQLite file path) stable across dev/packaged
// runs instead of depending on Electron's inferred name from package.json.
app.setName("reckon");

const HOTKEY = "CommandOrControl+Shift+D";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
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

app.whenReady().then(async () => {
  const prisma = getPrisma();
  const deviceId = getDeviceId();

  // Must finish before any handler can touch the database — packaged
  // builds have no `prisma migrate deploy` CLI available, so this is
  // the only place schema changes get applied on a user's machine.
  await runMigrations(prisma);

  registerIpcHandlers();
  createWindow();
  createTray();

  globalShortcut.register(HOTKEY, async () => {
    const text = await readSelectedText();
    if (!text) return;
    try {
      const entry = await lookupAndSaveVocab(prisma, deviceId, text);
      showPopup(entry);
    } catch {
      // Translation API unreachable or text unsupported — silently skip,
      // the user can retry.
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  // Intentionally a no-op: the tray keeps the app alive on Windows/Linux
  // even with no visible windows. Quitting happens via the tray's Quit
  // action, which sets isQuitting before calling app.quit().
});
