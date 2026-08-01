import { app, BrowserWindow, screen } from "electron";
import path from "node:path";
import type { TranslationResult } from "./translate";

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

export function showPopup(result: TranslationResult): void {
  const { x, y } = screen.getCursorScreenPosition();

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
