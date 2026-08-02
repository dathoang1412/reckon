import { app } from "electron";
import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";

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
    stdio: "inherit",
  });

  serverConfirmedReady = false;

  serverProcess.on("exit", (code) => {
    console.error(`[server] sync backend exited unexpectedly (code ${code})`);
    serverProcess = null;
    serverConfirmedReady = false;
  });
}

export function stopServer(): void {
  serverProcess?.kill();
  serverProcess = null;
  serverConfirmedReady = false;
}
