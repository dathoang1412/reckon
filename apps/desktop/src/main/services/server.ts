import { app } from "electron";
import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { logError, logInfo, logWarn } from "./log";

// Arbitrary port in the IANA private/dynamic range (49152-65535) — far from
// anything else on the machine is likely to be listening on.
export const SERVER_PORT = 49235;

let serverProcess: ChildProcess | null = null;
let serverConfirmedReady = false;

// NestJS takes a few hundred ms to boot (module init, Prisma connect); a
// fetch fired right after spawn() would hit ECONNREFUSED. Poll /health
// instead of guessing a fixed delay.
async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${SERVER_PORT}/health`);
      if (res.ok) return;
    } catch {
      // Not listening yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`sync backend did not become ready within ${timeoutMs}ms`);
}

// Callers (e.g. runSync) should await this before hitting the server so
// they get a clear "not ready" error instead of a raw fetch failure. This
// re-polls on every call until the first success rather than caching one
// boot-time promise — a slow first boot (e.g. antivirus scanning the
// freshly-extracted binary) must not permanently poison every later sync
// with the same stale timeout once the backend actually comes up.
export async function waitForServerReady(): Promise<void> {
  if (!serverProcess) throw new Error("sync backend is not running");
  if (serverConfirmedReady) return;
  await waitForHealth(20_000);
  serverConfirmedReady = true;
}

// Nest's default Logger tags every line with its level in caps (e.g.
// "...   ERROR [ExceptionsHandler] ..."), regardless of which stream it
// writes to — used as the primary signal so a try/catch logged at "error"
// still shows red in the Logs page even though Nest itself wrote it to
// stdout. Falls back to which stream the line came from only when no tag
// is found, since *something* not logged through Nest's own Logger could
// still land on stderr (e.g. an uncaught native crash).
const LEVEL_TAG = /\b(ERROR|WARN)\b/;

function detectLevel(line: string, fromStderr: boolean): "info" | "warn" | "error" {
  const tag = line.match(LEVEL_TAG)?.[1];
  if (tag === "ERROR") return "error";
  if (tag === "WARN") return "warn";
  return fromStderr ? "error" : "info";
}

// Line-buffers a child process stream into the shared log service (see
// services/log.ts) instead of just `stdio: "inherit"` — inherit only ever
// reached a terminal window happened to be attached to (dev mode), leaving
// a packaged build's sync backend with nowhere for its logs to go at all.
//
// An uncaught exception's stack trace arrives as many separate lines (one
// per frame, each indented) — emitted one-by-one, the Logs page (see
// LogViewer.tsx) would show a single error fanned out into dozens of rows
// that each look like their own unrelated event. Buffer indented
// continuation lines onto whatever entry is currently being built and only
// flush (emit) once a genuinely new, non-indented line starts.
function pipeToLog(stream: NodeJS.ReadableStream | null, fromStderr: boolean): void {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  let pending: string[] = [];

  function flush(): void {
    if (pending.length === 0) return;
    const block = pending.join("\n");
    pending = [];
    const level = detectLevel(block, fromStderr);
    if (level === "error") logError("server", block);
    else if (level === "warn") logWarn("server", block);
    else logInfo("server", block);
  }

  rl.on("line", (line) => {
    if (!line.trim()) {
      flush();
      return;
    }
    if (/^\s/.test(line) && pending.length > 0) {
      pending.push(line);
      return;
    }
    flush();
    pending.push(line);
  });
  rl.on("close", flush);
}

function serverEntryPath(): string {
  // Packaged builds ship a self-contained copy of @reckon/server (built +
  // its production node_modules, see electron-builder.yml) under
  // resources/server. In dev it's just the workspace package's own build
  // output, three levels up from apps/desktop/out/main.
  return app.isPackaged
    ? path.join(process.resourcesPath, "server", "dist", "main.js")
    : path.join(__dirname, "../../../server/dist/main.js");
}

// Runs the sync backend as a child process instead of in the same process
// as Electron: NestJS's dependency injection relies on TypeScript's
// emitDecoratorMetadata, which esbuild (electron-vite's bundler) doesn't
// support, so it can't be bundled into the main process build directly.
export function startServer(): void {
  const entry = serverEntryPath();
  const cwd = path.dirname(entry);

  // In a packaged build there's no guarantee `node` is on PATH, but
  // Electron's own binary can run plain JS as Node via this env var.
  const [command, env] = app.isPackaged
    ? [process.execPath, { ...process.env, ELECTRON_RUN_AS_NODE: "1" }]
    : ["node", { ...process.env }];

  // The desktop app's own DATABASE_URL (its local SQLite Prisma client)
  // must not leak into the sync server's env — it'd shadow the Postgres
  // DATABASE_URL the server's own .env is meant to provide, since Prisma
  // treats an already-set env var as authoritative over its .env file.
  const serverEnv: NodeJS.ProcessEnv = { ...env };
  delete serverEnv.DATABASE_URL;

  serverProcess = spawn(command, [entry], {
    cwd,
    env: { ...serverEnv, PORT: String(SERVER_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  pipeToLog(serverProcess.stdout, false);
  pipeToLog(serverProcess.stderr, true);

  serverConfirmedReady = false;

  serverProcess.on("exit", (code) => {
    logError("server", `sync backend exited unexpectedly (code ${code})`);
    serverProcess = null;
    serverConfirmedReady = false;
  });
}

export function stopServer(): void {
  serverProcess?.kill();
  serverProcess = null;
  serverConfirmedReady = false;
}
