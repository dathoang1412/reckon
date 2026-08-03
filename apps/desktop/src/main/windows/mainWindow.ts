import { BrowserWindow, app, shell } from "electron";
import path from "node:path";

// shouldStayOpen is checked on every close attempt (not just read once at
// creation) since it reflects the app's live quitting state — the window
// must keep hiding-instead-of-closing across every close attempt until the
// tray's Quit action actually flips it.
export function createMainWindow(shouldStayOpen: () => boolean): BrowserWindow {
  const win = new BrowserWindow({
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
  win.once("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // Hide instead of quitting so the app keeps running in the tray.
  win.on("close", (event) => {
    if (shouldStayOpen()) {
      event.preventDefault();
      win.hide();
    }
  });

  if (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return win;
}
