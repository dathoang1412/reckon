import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import type { DictionaryInfo } from "./dictionary";
import type { TranslationResult } from "./translate";

export interface ScreenPoint {
  x: number;
  y: number;
}

let popupWindow: BrowserWindow | null = null;

// Matches the content's own maxWidth (see Popup.tsx) so a measurement never
// starts out narrower than the content is allowed to be.
const BASELINE_WIDTH = 420;
const BASELINE_HEIGHT = 500;

// Where the popup should anchor once the renderer reports its measured
// size (see the "popup:resize" handler below) — captured at the moment the
// hotkey fires (before the async translate/DB round-trip), not later,
// otherwise the popup ends up wherever the cursor drifted to while the
// lookup was in flight instead of where the user's selection was.
let anchor: ScreenPoint = { x: 0, y: 0 };

function createPopupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    // The window stays hidden until it's resized to the real measured
    // size anyway, so this initial size only matters as the baseline the
    // very first measurement happens at (see BASELINE_WIDTH/HEIGHT).
    width: BASELINE_WIDTH,
    height: BASELINE_HEIGHT,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      // This window is hidden between lookups (see showPopup's reuse
      // path), and Chromium throttles timers/rAF for hidden windows by
      // default — that's exactly what broke the resize round-trip on
      // every lookup after the first.
      backgroundThrottling: false,
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

// The renderer measures its own rendered content once after layout (see
// Popup.tsx) and reports it here — a fixed window size either wastes space
// when there's no dictionary data or clips a long one, so the window is
// sized to fit after the fact instead of guessed up front. Also where the
// window actually gets shown, so it never flashes at the wrong size.
//
// This must stay a one-shot report from the renderer, not a live
// ResizeObserver: the content div is `width: fit-content`, so its measured
// size depends on the window's current viewport — resizing the window in
// response to a live observer would itself trigger another resize
// notification, feeding back into itself until the window collapses to
// whatever the smallest stable size is (one word per line).
ipcMain.on("popup:resize", (event, size: { width: number; height: number }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win !== popupWindow) return;

  const area = screen.getDisplayNearestPoint(anchor).workArea;
  const width = Math.max(160, Math.min(Math.ceil(size.width), area.width));
  const height = Math.max(80, Math.min(Math.ceil(size.height), area.height));

  let x = anchor.x;
  let y = anchor.y;
  if (x + width > area.x + area.width) x = area.x + area.width - width;
  if (x < area.x) x = area.x;
  if (y + height > area.y + area.height) y = area.y + area.height - height;
  if (y < area.y) y = area.y;

  win.setContentSize(width, height);
  win.setPosition(x, y);
  win.show();
  win.focus();
});

export function showPopup(result: TranslationResult, point: ScreenPoint, dictionary: DictionaryInfo | null): void {
  anchor = point;
  const payload = { result, dictionary };

  if (!popupWindow) {
    popupWindow = createPopupWindow();
    const win = popupWindow;
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("translation:result", payload);
    });
    return;
  }

  // Hidden until the resize handler above re-shows it at the new content's
  // size/position — otherwise the old content would flash at its old size
  // for a frame while the new content loads. Also reset back to the
  // generous baseline size first: leaving the *previous* lookup's (maybe
  // much narrower) size in place would force this content's own
  // measurement to word-wrap within that leftover width, under-measuring
  // the height it actually needs at its true (wider) final size.
  popupWindow.setContentSize(BASELINE_WIDTH, BASELINE_HEIGHT);
  popupWindow.hide();
  popupWindow.webContents.send("translation:result", payload);
}
