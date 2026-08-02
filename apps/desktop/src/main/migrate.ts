import { app } from "electron";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../../generated/client";

function migrationsDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "prisma", "migrations")
    : path.join(__dirname, "../../prisma/migrations");
}

// Electron can't shell out to the `prisma migrate deploy` CLI in a
// packaged app (no bundled engines/CLI for it), so this reimplements
// just enough of it: apply any migration.sql not yet recorded, using
// the same `_prisma_migrations` table and sha256-of-file checksum
// Prisma itself uses, so `prisma migrate dev` during local development
// stays interoperable with what this applies on startup.
export async function runMigrations(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
    )
  `);

  const appliedRows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM "_prisma_migrations"`,
  );
  const applied = new Set(appliedRows.map((r) => r.migration_name));

  const dir = migrationsDir();
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const name of names) {
    if (applied.has(name)) continue;

    const sql = fs.readFileSync(path.join(dir, name, "migration.sql"), "utf-8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
       VALUES (?, ?, current_timestamp, ?, current_timestamp, ?)`,
      randomUUID(),
      checksum,
      name,
      statements.length,
    );
  }
}
