import { app } from "electron";
import path from "node:path";
import { PrismaClient } from "../../generated/client";

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    const dbPath = path.join(app.getPath("userData"), "reckon.db");
    prisma = new PrismaClient({
      datasources: { db: { url: `file:${dbPath}` } },
    });
  }
  return prisma;
}
