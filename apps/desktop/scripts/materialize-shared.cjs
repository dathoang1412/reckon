// electron-builder's asar packer refuses any file that resolves outside
// the app's own directory. `@reckon/shared` normally lives in
// apps/desktop/node_modules as a symlink out to ../../packages/shared, so
// packaging fails unless we replace that symlink with a real copy first.
// zod is @reckon/shared's only runtime dependency and is itself a
// pnpm-store symlink, so it needs the same treatment.
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../../..");
const dest = path.join(repoRoot, "apps/desktop/node_modules/@reckon/shared");

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(path.join(repoRoot, "packages/shared/dist"), path.join(dest, "dist"), { recursive: true });
fs.copyFileSync(path.join(repoRoot, "packages/shared/package.json"), path.join(dest, "package.json"));

const zodRealPath = fs.realpathSync(path.join(repoRoot, "packages/shared/node_modules/zod"));
fs.cpSync(zodRealPath, path.join(dest, "node_modules/zod"), { recursive: true, dereference: true });

console.log(`materialized @reckon/shared -> ${dest}`);
