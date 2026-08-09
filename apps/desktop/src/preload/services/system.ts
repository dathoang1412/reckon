import { ipcRenderer } from "electron";
import type { LogEntry } from "../types";

export const tts = {
  // Base64-encoded MP3 — IPC's structured clone handles ArrayBuffer fine,
  // but base64 keeps the channel's payload type simple/JSON-serializable
  // like the rest of the API.
  speak: (text: string, lang: string) => ipcRenderer.invoke("tts:speak", text, lang) as Promise<string>,
};

export const sync = {
  run: () => ipcRenderer.invoke("sync:run") as Promise<{ pushed: number; pulled: number }>,
};

export const popup = {
  resize: (size: { width: number; height: number }) => ipcRenderer.send("popup:resize", size),
  hide: () => ipcRenderer.send("popup:hide"),
};

export const app = {
  getVersion: () => ipcRenderer.invoke("app:getVersion") as Promise<string>,
};

export const log = {
  // Backfill — call once on mount, before subscribing to onEntry, so
  // nothing logged before the Logs panel opened is missed.
  getHistory: () => ipcRenderer.invoke("log:history") as Promise<LogEntry[]>,
  onEntry: (callback: (entry: LogEntry) => void) => {
    ipcRenderer.on("log:entry", (_event, entry: LogEntry) => callback(entry));
  },
};

export const updater = {
  checkNow: () => ipcRenderer.invoke("updater:checkNow") as Promise<void>,
  quitAndInstall: () => ipcRenderer.invoke("updater:quitAndInstall") as Promise<void>,
};
