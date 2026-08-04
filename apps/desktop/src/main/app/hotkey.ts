import { BrowserWindow, globalShortcut, screen } from "electron";
import { getPrisma } from "../db/client";
import { parseTargetMeanings, previewVocab, saveVocab } from "../services/vocab";
import { getSession } from "../utils/authSession";
import { getDeviceId } from "../utils/deviceId";
import { readSelectedText } from "../utils/selection";
import { showPopup, showSearchPopup } from "../windows/popup";

export interface HotkeyManager {
  register(accelerator: string): boolean;
}

async function onHotkeyTriggered(getMainWindow: () => BrowserWindow | null): Promise<void> {
  // Login is mandatory app-wide, including this hotkey path — if there's no
  // session, surface the (already-rendered) login screen instead of running
  // a lookup that would just save data with no account attached to it.
  if (!getSession()) {
    getMainWindow()?.show();
    return;
  }

  // Captured before the async selection/translate/DB round-trip so the
  // popup lands where the user's selection was, not wherever the cursor
  // has drifted to by the time the lookup finishes.
  const cursorPosition = screen.getCursorScreenPoint();

  const text = await readSelectedText();
  if (!text) return;
  try {
    const { result, dictionary } = await previewVocab(text);
    const saved = await saveVocab(getPrisma(), getDeviceId(), result);
    const entry = { ...saved, targetMeanings: parseTargetMeanings(saved), createdAt: saved.createdAt.toISOString() };
    showPopup(entry, cursorPosition, dictionary);
    // Keep the main window's list live if it's open (or just hidden in
    // the tray) instead of only refreshing on next manual reload.
    getMainWindow()?.webContents.send("vocab:created", entry);
  } catch (err) {
    console.error("[hotkey] lookup failed:", err);
  }
}

// A search-hotkey trigger has no selected text to work from — it just pops
// the popup up empty (anchored at the cursor, same as the lookup one) for
// the user to type a word into themselves.
function onSearchHotkeyTriggered(getMainWindow: () => BrowserWindow | null): void {
  if (!getSession()) {
    getMainWindow()?.show();
    return;
  }
  showSearchPopup(screen.getCursorScreenPoint());
}

// Wraps globalShortcut registration so callers don't need to track "what's
// currently bound" themselves — re-registering swaps the old binding out
// first and falls back to it if the new one is already claimed by another
// app at the OS level, so the app never ends up with no working hotkey at
// all. Shared by both the lookup and search-popup hotkeys (see the two
// factories below) since each just needs its own independent binding.
function createManager(trigger: () => void): HotkeyManager {
  let currentHotkey: string | null = null;

  function register(accelerator: string): boolean {
    const previous = currentHotkey;
    if (previous) globalShortcut.unregister(previous);

    const ok = globalShortcut.register(accelerator, trigger);
    if (ok) {
      currentHotkey = accelerator;
    } else {
      console.error(
        `[hotkey] Failed to register ${accelerator} — another running app has probably already claimed it at the OS level.`,
      );
      if (previous) globalShortcut.register(previous, trigger);
    }
    return ok;
  }

  return { register };
}

export function createHotkeyManager(getMainWindow: () => BrowserWindow | null): HotkeyManager {
  return createManager(() => onHotkeyTriggered(getMainWindow));
}

export function createSearchHotkeyManager(getMainWindow: () => BrowserWindow | null): HotkeyManager {
  return createManager(() => onSearchHotkeyTriggered(getMainWindow));
}
