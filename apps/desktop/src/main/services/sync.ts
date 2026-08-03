import {
  resolveConflict,
  vocabEntryDataSchema,
  vocabSetDataSchema,
  type SyncChange,
  type SyncPullResponse,
} from "@reckon/shared";
import type { PrismaClient, VocabEntry, VocabSet } from "../../../generated/client";
import { getSession } from "../utils/authSession";
import { SERVER_PORT, waitForServerReady } from "./server";
import { parseTags, parseTargetMeanings } from "./vocab";

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
      targetMeanings: parseTargetMeanings(entry),
      targetLang: entry.targetLang,
      setId: entry.setId,
      createdAt: entry.createdAt.toISOString(),
      note: entry.note,
      tags: parseTags(entry),
      definition: entry.definition,
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
      targetMeanings: JSON.stringify(data.targetMeanings),
      targetLang: data.targetLang,
      setId: data.setId,
      createdAt: new Date(data.createdAt),
      note: data.note,
      tags: JSON.stringify(data.tags),
      definition: data.definition,
      updatedAt: new Date(change.updatedAt),
      deviceId: change.deviceId,
      deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
    },
    update: {
      sourceText: data.sourceText,
      sourceLang: data.sourceLang,
      targetText: data.targetText,
      targetMeanings: JSON.stringify(data.targetMeanings),
      targetLang: data.targetLang,
      setId: data.setId,
      createdAt: new Date(data.createdAt),
      note: data.note,
      tags: JSON.stringify(data.tags),
      definition: data.definition,
      updatedAt: new Date(change.updatedAt),
      deviceId: change.deviceId,
      deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
    },
  });
  return true;
}

function vocabSetToChange(set: VocabSet): SyncChange {
  return {
    kind: "vocabSet",
    id: set.id,
    updatedAt: set.updatedAt.toISOString(),
    deviceId: set.deviceId,
    deletedAt: set.deletedAt ? set.deletedAt.toISOString() : null,
    data: { name: set.name },
  };
}

async function applyVocabSetChange(prisma: PrismaClient, change: SyncChange): Promise<boolean> {
  const existing = await prisma.vocabSet.findUnique({ where: { id: change.id } });
  if (existing) {
    const winner = resolveConflict(vocabSetToChange(existing), change);
    if (winner.deviceId === existing.deviceId && winner.updatedAt === existing.updatedAt.toISOString()) {
      return false;
    }
  }

  const data = vocabSetDataSchema.parse(change.data);
  await prisma.vocabSet.upsert({
    where: { id: change.id },
    create: {
      id: change.id,
      name: data.name,
      updatedAt: new Date(change.updatedAt),
      deviceId: change.deviceId,
      deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
    },
    update: {
      name: data.name,
      updatedAt: new Date(change.updatedAt),
      deviceId: change.deviceId,
      deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
    },
  });
  return true;
}

export async function runSync(prisma: PrismaClient, deviceId: string): Promise<{ pushed: number; pulled: number }> {
  const session = getSession();
  if (!session) throw new Error("Chưa đăng nhập — vui lòng đăng nhập trước khi đồng bộ.");
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` };

  await waitForServerReady();

  const [localEntries, localSets] = await Promise.all([prisma.vocabEntry.findMany(), prisma.vocabSet.findMany()]);
  const changes = [...localEntries.map(vocabToChange), ...localSets.map(vocabSetToChange)];

  const pushRes = await fetch(`${SERVER_URL}/sync/push`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ deviceId, changes }),
  });
  if (!pushRes.ok) throw new Error(`Đồng bộ (push) thất bại — HTTP ${pushRes.status}`);

  const state = await prisma.syncState.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  const pullRes = await fetch(`${SERVER_URL}/sync/pull`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ deviceId, since: state.lastPulledAt?.toISOString() ?? null }),
  });
  if (!pullRes.ok) throw new Error(`Đồng bộ (pull) thất bại — HTTP ${pullRes.status}`);
  const { changes: remoteChanges, serverTime }: SyncPullResponse = await pullRes.json();

  let pulled = 0;
  for (const change of remoteChanges) {
    if (change.kind === "vocab") {
      if (await applyVocabChange(prisma, change)) pulled++;
    } else if (change.kind === "vocabSet") {
      if (await applyVocabSetChange(prisma, change)) pulled++;
    }
  }

  await prisma.syncState.update({ where: { id: 1 }, data: { lastPulledAt: new Date(serverTime) } });

  return { pushed: changes.length, pulled };
}
