import { ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { taskSchema } from "@reckon/shared";
import { getPrisma } from "./db";
import { getDeviceId } from "./deviceId";

export function registerIpcHandlers(): void {
  const prisma = getPrisma();
  const deviceId = getDeviceId();

  ipcMain.handle("tasks:list", async () => {
    return prisma.task.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  });

  ipcMain.handle("tasks:create", async (_event, rawTitle: unknown) => {
    const title = taskSchema.shape.title.parse(rawTitle);
    return prisma.task.create({
      data: { id: randomUUID(), title, updatedAt: new Date(), deviceId },
    });
  });

  ipcMain.handle("tasks:toggle", async (_event, id: string) => {
    const task = await prisma.task.findUniqueOrThrow({ where: { id } });
    return prisma.task.update({
      where: { id },
      data: { done: !task.done, updatedAt: new Date(), deviceId },
    });
  });

  ipcMain.handle("tasks:delete", async (_event, id: string) => {
    return prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), updatedAt: new Date(), deviceId },
    });
  });
}
