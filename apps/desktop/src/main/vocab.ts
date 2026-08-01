import { randomUUID } from "node:crypto";
import type { PrismaClient, VocabEntry } from "../../generated/client";
import { translate } from "./translate";

export function listVocabEntries(prisma: PrismaClient): Promise<VocabEntry[]> {
  return prisma.vocabEntry.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
}

export async function lookupAndSaveVocab(prisma: PrismaClient, deviceId: string, text: string): Promise<VocabEntry> {
  const result = await translate(text);
  return prisma.vocabEntry.create({
    data: { id: randomUUID(), ...result, updatedAt: new Date(), deviceId },
  });
}

export function deleteVocabEntry(prisma: PrismaClient, deviceId: string, id: string): Promise<VocabEntry> {
  return prisma.vocabEntry.update({
    where: { id },
    data: { deletedAt: new Date(), updatedAt: new Date(), deviceId },
  });
}
