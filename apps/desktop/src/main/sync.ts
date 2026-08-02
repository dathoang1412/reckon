import { resolveConflict, vocabEntryDataSchema, type SyncChange, type SyncPullResponse } from "@reckon/shared";
import type { PrismaClient, VocabEntry } from "../../generated/client";
import { SERVER_PORT } from "./server";

const SERVER_URL = `http://localhost:${SERVER_PORT}`;

function vocabToChange(entry: VocabEntry): SyncChange {
  return {
    kind: "vocab",
    id: entry.id,
    updatedAt: entry.updatedAt.toISOString(),
    deviceId: entry.deviceId,
    deletedAt: entry.deletedAt ? entry.deletedAt.toISOString() : null,
    data: {
      sourceText: entry.sourceText,
      sourceLang: entry.sourceLang,
      targetText: entry.targetText,
      targetLang: entry.targetLang,
    },
  };
}

async function applyVocabChange(prisma: PrismaClient, change: SyncChange): Promise<boolean> {
  const existing = await prisma.vocabEntry.findUnique({ where: { id: change.id } });
  if (existing) {
    const winner = resolveConflict(vocabToChange(existing), change);
    if (winner.deviceId === existing.deviceId && winner.updatedAt === existing.updatedAt.toISOString()) {
      return false;
    }
  }

  const data = vocabEntryDataSchema.parse(change.data);
  await prisma.vocabEntry.upsert({
    where: { id: change.id },
    create: {
      id: change.id,
      sourceText: data.sourceText,
      sourceLang: data.sourceLang,
      targetText: data.targetText,
      targetLang: data.targetLang,
      updatedAt: new Date(change.updatedAt),
      deviceId: change.deviceId,
      deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
    },
    update: {
      sourceText: data.sourceText,
      sourceLang: data.sourceLang,
      targetText: data.targetText,
      targetLang: data.targetLang,
      updatedAt: new Date(change.updatedAt),
      deviceId: change.deviceId,
      deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
    },
  });
  return true;
}

export async function runSync(prisma: PrismaClient, deviceId: string): Promise<{ pushed: number; pulled: number }> {
  const localEntries = await prisma.vocabEntry.findMany();
  const changes = localEntries.map(vocabToChange);

  await fetch(`${SERVER_URL}/sync/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, changes }),
  });

  const state = await prisma.syncState.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  const pullRes = await fetch(`${SERVER_URL}/sync/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, since: state.lastPulledAt?.toISOString() ?? null }),
  });
  const { changes: remoteChanges, serverTime }: SyncPullResponse = await pullRes.json();

  let pulled = 0;
  for (const change of remoteChanges) {
    if (change.kind !== "vocab") continue;
    if (await applyVocabChange(prisma, change)) pulled++;
  }

  await prisma.syncState.update({ where: { id: 1 }, data: { lastPulledAt: new Date(serverTime) } });

  return { pushed: changes.length, pulled };
}
