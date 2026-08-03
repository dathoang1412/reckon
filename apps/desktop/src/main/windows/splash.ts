import { app, BrowserWindow } from "electron";
import path from "node:path";

let splashWindow: BrowserWindow | null = null;

export function createSplashWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 320,
    height: 360,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    splashWindow = null;
  });

  if (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}#splash`);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"), { hash: "splash" });
  }

  splashWindow = win;
  return win;
}

export function closeSplashWindow(): void {
  splashWindow?.close();
  splashWindow = null;
}
