import { resolveConflict, taskDataSchema, type SyncChange, type SyncPullResponse } from "@reckon/shared";
import type { PrismaClient, Task } from "../../generated/client";

const SERVER_URL = "http://localhost:3000";

function taskToChange(task: Task): SyncChange {
  return {
    kind: "task",
    id: task.id,
    updatedAt: task.updatedAt.toISOString(),
    deviceId: task.deviceId,
    deletedAt: task.deletedAt ? task.deletedAt.toISOString() : null,
    data: {
      title: task.title,
      notes: task.notes,
      done: task.done,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    },
  };
}

async function applyTaskChange(prisma: PrismaClient, change: SyncChange): Promise<boolean> {
  const existing = await prisma.task.findUnique({ where: { id: change.id } });
  if (existing) {
    const winner = resolveConflict(taskToChange(existing), change);
    if (winner.deviceId === existing.deviceId && winner.updatedAt === existing.updatedAt.toISOString()) {
      return false;
    }
  }

  const data = taskDataSchema.parse(change.data);
  await prisma.task.upsert({
    where: { id: change.id },
    create: {
      id: change.id,
      title: data.title,
      notes: data.notes,
      done: data.done,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      updatedAt: new Date(change.updatedAt),
      deviceId: change.deviceId,
      deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
    },
    update: {
      title: data.title,
      notes: data.notes,
      done: data.done,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      updatedAt: new Date(change.updatedAt),
      deviceId: change.deviceId,
      deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
    },
  });
  return true;
}

export async function runSync(prisma: PrismaClient, deviceId: string): Promise<{ pushed: number; pulled: number }> {
  const localTasks = await prisma.task.findMany();
  const changes = localTasks.map(taskToChange);

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
    if (change.kind !== "task") continue;
    if (await applyTaskChange(prisma, change)) pulled++;
  }

  await prisma.syncState.update({ where: { id: 1 }, data: { lastPulledAt: new Date(serverTime) } });

  return { pushed: changes.length, pulled };
}
