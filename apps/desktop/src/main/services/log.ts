import { BrowserWindow } from "electron";
import chalk from "chalk";

export type LogLevel = "info" | "warn" | "error";
// "app" is this Electron process itself (main-process console output);
// "server" is the spawned NestJS sync backend (see services/server.ts),
// which otherwise has nowhere to show its logs in a packaged build — no
// terminal is attached once the app isn't launched from one.
export type LogSource = "app" | "server";

export interface LogEntry {
  id: number;
  // ISO timestamp — kept as a string (not Date) so it crosses the IPC
  // structured-clone boundary and JSON.stringify unchanged either way.
  timestamp: string;
  source: LogSource;
  level: LogLevel;
  message: string;
}

// Ring buffer, not unbounded — this lives for the whole app session, and a
// long-running instance (the tray keeps it alive indefinitely on
// Windows/Linux, see index.ts) would otherwise leak memory one log line at
// a time. Also what backfills a Logs page opened after startup — see
// getLogHistory.
const MAX_ENTRIES = 2000;
const buffer: LogEntry[] = [];
let nextId = 1;

const LEVEL_COLOR: Record<LogLevel, chalk.Chalk> = {
  info: chalk.cyanBright,
  warn: chalk.yellowBright,
  error: chalk.redBright,
};

const SOURCE_COLOR: Record<LogSource, chalk.Chalk> = {
  app: chalk.magentaBright,
  server: chalk.greenBright,
};

function formatForTerminal(entry: LogEntry): string {
  const time = chalk.dim(entry.timestamp.slice(11, 19));
  const source = SOURCE_COLOR[entry.source](`[${entry.source}]`.padEnd(8));
  const level = LEVEL_COLOR[entry.level].bold(entry.level.toUpperCase().padEnd(5));
  return `${time} ${source} ${level} ${entry.message}`;
}

// Pushes a line into the in-app Logs page (see LogViewer.tsx) and mirrors
// it to this process's own stdout/stderr with chalk coloring — the latter
// keeps `electron-vite dev`'s terminal readable the way plain
// console.log/error already was, this just adds a level/source-tagged
// format shared with the in-app view instead of two independent styles.
export function addLog(source: LogSource, level: LogLevel, message: string): LogEntry {
  const entry: LogEntry = { id: nextId++, timestamp: new Date().toISOString(), source, level, message };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();

  const line = formatForTerminal(entry);
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("log:entry", entry);
  }
  return entry;
}

// Backfill for a Logs page mounting after startup — live entries alone
// would otherwise miss everything logged before that window existed (e.g.
// the sync backend's own boot sequence).
export function getLogHistory(): LogEntry[] {
  return buffer;
}

export const logInfo = (source: LogSource, message: string): LogEntry => addLog(source, "info", message);
export const logWarn = (source: LogSource, message: string): LogEntry => addLog(source, "warn", message);
export const logError = (source: LogSource, message: string): LogEntry => addLog(source, "error", message);
