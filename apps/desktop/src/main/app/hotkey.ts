import { BrowserWindow, globalShortcut, screen } from "electron";
import { getPrisma } from "../db/client";
import { logError } from "../services/log";
import { parseTargetMeanings, previewVocab, saveVocab } from "../services/vocab";
import { getDeviceId } from "../utils/deviceId";
import { getAutoSave } from "../utils/settings";
import { readSelectedText } from "../utils/selection";
import { showPopup, showPreviewPopup, showSearchPopup } from "../windows/popup";

export interface HotkeyManager {
  register(accelerator: string): boolean;
}

// Login is opt-in (see components/LoginModal.tsx), not required to use the
// app — this lookup/save is entirely local (SQLite via services/vocab.ts),
// no account needed. Only Sync and the profile section in Settings ever
// touch the shared server.
async function onHotkeyTriggered(getMainWindow: () => BrowserWindow | null): Promise<void> {
  // Captured before the async selection/translate/DB round-trip so the
  // popup lands where the user's selection was, not wherever the cursor
  // has drifted to by the time the lookup finishes.
  const cursorPosition = screen.getCursorScreenPoint();

  const text = await readSelectedText();
  if (!text) return;
  try {
    const { result, dictionary, spellingSuggestion } = await previewVocab(text);

    // Off (see Settings): the popup gets an unsaved preview with a manual
    // Save button instead — same "preview, then decide" flow the
    // empty-search-popup hotkey already uses, just anchored at the
    // selection point instead of centered (there's a real selection here).
    if (!getAutoSave()) {
      showPreviewPopup({ result, dictionary, spellingSuggestion }, cursorPosition);
      return;
    }

    const saved = await saveVocab(getPrisma(), getDeviceId(), result);
    const entry = { ...saved, targetMeanings: parseTargetMeanings(saved), createdAt: saved.createdAt.toISOString() };
    showPopup(entry, cursorPosition, dictionary);
    // Keep the main window's list live if it's open (or just hidden in
    // the tray) instead of only refreshing on next manual reload.
    getMainWindow()?.webContents.send("vocab:created", entry);
  } catch (err) {
    logError("app", `[hotkey] lookup failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// A search-hotkey trigger has no selected text to work from — it just pops
// the popup up empty (anchored at the cursor, same as the lookup one) for
// the user to type a word into themselves.
function onSearchHotkeyTriggered(): void {
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
      logError(
        "app",
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

export function createSearchHotkeyManager(): HotkeyManager {
  return createManager(onSearchHotkeyTriggered);
}
