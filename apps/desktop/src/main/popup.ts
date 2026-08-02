import { app, BrowserWindow } from "electron";
import path from "node:path";
import type { TranslationResult } from "./translate";

export interface ScreenPoint {
  x: number;
  y: number;
}

let popupWindow: BrowserWindow | null = null;

function createPopupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 340,
    height: 180,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  win.on("blur", () => win.hide());
  win.on("closed", () => {
    popupWindow = null;
  });

  if (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}#popup`);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"), { hash: "popup" });
  }

  return win;
}

// Position is captured by the caller at the moment the hotkey fires
// (before the async translate/DB round-trip), not here — otherwise the
// popup ends up wherever the cursor drifted to while the lookup was in
// flight instead of where the user's selection was.
export function showPopup(result: TranslationResult, { x, y }: ScreenPoint): void {
  if (!popupWindow) {
    popupWindow = createPopupWindow();
    const win = popupWindow;
    win.setPosition(x, y);
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("translation:result", result);
      win.show();
      win.focus();
    });
    return;
  }

  popupWindow.setPosition(x, y);
  popupWindow.webContents.send("translation:result", result);
  popupWindow.show();
  popupWindow.focus();
}
