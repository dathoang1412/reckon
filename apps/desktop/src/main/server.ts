import { app } from "electron";
import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";

// Arbitrary port in the IANA private/dynamic range (49152-65535) — far from
// anything else on the machine is likely to be listening on.
export const SERVER_PORT = 49235;

let serverProcess: ChildProcess | null = null;

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

  serverProcess = spawn(command, [entry], {
    cwd,
    env: { ...env, PORT: String(SERVER_PORT) },
    stdio: "inherit",
  });

  serverProcess.on("exit", (code) => {
    console.error(`[server] sync backend exited unexpectedly (code ${code})`);
    serverProcess = null;
  });
}

export function stopServer(): void {
  serverProcess?.kill();
  serverProcess = null;
}
