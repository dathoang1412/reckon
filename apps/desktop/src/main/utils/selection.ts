import { clipboard } from "electron";
import { Key, keyboard } from "@nut-tree-fork/nut-js";

const COPY_KEY = process.platform === "darwin" ? Key.LeftCmd : Key.LeftControl;

// Reads whatever text is currently selected in the foreground app by
// simulating the OS copy shortcut, so the hotkey works on a bare
// selection instead of requiring the user to Ctrl+C first. The
// clipboard is cleared before copying (so "nothing selected" reads as
// empty rather than stale old contents) and its previous contents are
// restored afterward so this doesn't clobber what the user had copied.
export async function readSelectedText(): Promise<string> {
  const previousClipboard = clipboard.readText();
  clipboard.writeText("");

  await keyboard.pressKey(COPY_KEY, Key.C);
  await keyboard.releaseKey(COPY_KEY, Key.C);
  await sleep(150);

  const selected = clipboard.readText().trim();
  clipboard.writeText(previousClipboard);
  return selected;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
