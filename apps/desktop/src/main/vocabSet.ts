import { randomUUID } from "node:crypto";
import type { PrismaClient, VocabSet } from "../../generated/client";

export function listVocabSets(prisma: PrismaClient): Promise<VocabSet[]> {
  return prisma.vocabSet.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export function createVocabSet(prisma: PrismaClient, deviceId: string, name: string): Promise<VocabSet> {
  return prisma.vocabSet.create({
    data: { id: randomUUID(), name, updatedAt: new Date(), deviceId },
  });
}

export function renameVocabSet(
  prisma: PrismaClient,
  deviceId: string,
  id: string,
  name: string,
): Promise<VocabSet> {
  return prisma.vocabSet.update({
    where: { id },
    data: { name, updatedAt: new Date(), deviceId },
  });
}

// Soft-deletes the set and unassigns (not deletes) every entry in it —
// losing a grouping shouldn't lose the words themselves.
export async function deleteVocabSet(prisma: PrismaClient, deviceId: string, id: string): Promise<VocabSet> {
  const now = new Date();
  await prisma.vocabEntry.updateMany({
    where: { setId: id },
    data: { setId: null, updatedAt: now, deviceId },
  });
  return prisma.vocabSet.update({
    where: { id },
    data: { deletedAt: now, updatedAt: now, deviceId },
  });
}
