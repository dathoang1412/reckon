import { BrowserWindow, app, shell } from "electron";
import path from "node:path";

// Without a floor, the renderer's layout (list + sidebar side by side,
// modals with their own minimum widths) has no way to stay usable — it can
// only clip/overflow past some point, and `overflow: hidden` on <body>
// (see renderer/index.html) makes that invisible instead of a scrollbar.
// This is the width/height below which things start to break even after
// the responsive fixes elsewhere.
const MIN_WIDTH = 720;
const MIN_HEIGHT = 560;

// shouldStayOpen is checked on every close attempt (not just read once at
// creation) since it reflects the app's live quitting state — the window
// must keep hiding-instead-of-closing across every close attempt until the
// tray's Quit action actually flips it.
export function createMainWindow(shouldStayOpen: () => boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  // Belt-and-suspenders on top of minWidth/minHeight above: Windows' own
  // Snap (dragging to an edge/corner, or Win+Arrow) can resize a window
  // below its declared minimum size without going through the constraints
  // Electron/Chromium normally enforce for manual edge-dragging — a known
  // gap between the OS's snap layout and the window's own size hints.
  // Vetoing any resize that would violate the floor here catches that path
  // too, not just interactive drag-resizing.
  win.on("will-resize", (event, newBounds) => {
    if (newBounds.width < MIN_WIDTH || newBounds.height < MIN_HEIGHT) event.preventDefault();
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
