import { globalShortcut, screen } from "electron";
import { getPrisma } from "../db/client";
import { checkGrammar } from "../services/ai/ai";
import { logError } from "../services/system/log";
import { previewVocab, saveVocab, toVocabEntryRow } from "../services/vocab/vocab";
import { broadcast } from "../utils/broadcast";
import { getDeviceId } from "../utils/deviceId";
import { getAutoSave } from "../utils/settings";
import { readSelectedText } from "../utils/selection";
import { showGrammarPopup, showPopup, showPreviewPopup, showSearchPopup } from "../windows/popup";

export interface HotkeyManager {
  register(accelerator: string): boolean;
}

// Login is opt-in (see components/LoginModal.tsx), not required to use the
// app — this lookup/save is entirely local (SQLite via services/vocab/vocab.ts),
// no account needed. Only Sync and the profile section in Settings ever
// touch the shared server.
async function onHotkeyTriggered(): Promise<void> {
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
    const entry = toVocabEntryRow(saved);
    showPopup(entry, cursorPosition, dictionary);
    // Keep every open window's list live (main window if it's open — or
    // just hidden in the tray — and the popup's own browse tab) instead of
    // only refreshing on next manual reload/reopen.
    broadcast("vocab:created", entry);
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

// Ctrl+Shift+G by default — reuses the same selection-reading mechanism as
// the lookup hotkey above, just fed to checkGrammar (a Groq call) instead
// of translate/dictionary, and shown via a distinct popup channel
// (grammar:result) so Popup.tsx can tell it apart from a word lookup.
async function onGrammarHotkeyTriggered(): Promise<void> {
  const cursorPosition = screen.getCursorScreenPoint();

  const text = await readSelectedText();
  if (!text) return;
  try {
    const result = await checkGrammar(text);
    showGrammarPopup(result, cursorPosition);
  } catch (err) {
    logError("app", `[hotkey] grammar check failed: ${err instanceof Error ? err.message : String(err)}`);
  }
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

export function createHotkeyManager(): HotkeyManager {
  return createManager(onHotkeyTriggered);
}

export function createSearchHotkeyManager(): HotkeyManager {
  return createManager(onSearchHotkeyTriggered);
}

export function createGrammarHotkeyManager(): HotkeyManager {
  return createManager(onGrammarHotkeyTriggered);
}
