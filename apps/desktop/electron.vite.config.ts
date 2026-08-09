import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin, loadEnv } from "electron-vite";
import react from "@vitejs/plugin-react";

// The main process build targets CommonJS (see tsconfig.node.json's
// "module": "NodeNext"), where `import.meta.env` isn't valid syntax — so
// build-time secrets (Google OAuth client id/secret, see
// main/services/auth/googleAuth.ts) get baked in as plain `process.env.*`
// string literals via `define` instead of electron-vite's usual
// import.meta.env.MAIN_VITE_* mechanism, which only really works cleanly
// for the renderer/ESM side.
const env = loadEnv(process.env.NODE_ENV ?? "development", __dirname);

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      "process.env.GOOGLE_CLIENT_ID": JSON.stringify(env.MAIN_VITE_GOOGLE_CLIENT_ID ?? ""),
      "process.env.GOOGLE_CLIENT_SECRET": JSON.stringify(env.MAIN_VITE_GOOGLE_CLIENT_SECRET ?? ""),
    },
    build: {
      // Generated Prisma client is outside node_modules; keep it external so Node resolves it (and its engine binary) at runtime instead of Rollup bundling it.
      rollupOptions: {
        external: [/generated\/client/],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: "src/renderer",
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/renderer/index.html"),
      },
    },
    plugins: [react()],
  },
});
