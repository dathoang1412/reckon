// electron.vite.config.ts
import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
var __electron_vite_injected_dirname = "D:\\Coding\\PROJECT\\reckoff\\apps\\desktop";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // Generated Prisma client is outside node_modules; keep it external so Node resolves it (and its engine binary) at runtime instead of Rollup bundling it.
      rollupOptions: {
        external: [/generated\/client/]
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: "src/renderer",
    build: {
      rollupOptions: {
        input: resolve(__electron_vite_injected_dirname, "src/renderer/index.html")
      }
    },
    plugins: [react()]
  }
});
export {
  electron_vite_config_default as default
};
