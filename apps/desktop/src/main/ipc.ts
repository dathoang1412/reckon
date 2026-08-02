import { ipcMain } from "electron";
import { getPrisma } from "./db";
import { getDeviceId } from "./deviceId";
import { listDueEntries, rateReview } from "./review";
import { runSync } from "./sync";
import { deleteVocabEntry, listVocabEntries, lookupAndSaveVocab } from "./vocab";

export function registerIpcHandlers(): void {
  const prisma = getPrisma();
  const deviceId = getDeviceId();

  ipcMain.handle("vocab:list", async () => {
    return listVocabEntries(prisma);
  });

  ipcMain.handle("vocab:lookup", async (_event, text: string) => {
    return lookupAndSaveVocab(prisma, deviceId, text);
  });

  ipcMain.handle("vocab:delete", async (_event, id: string) => {
    return deleteVocabEntry(prisma, deviceId, id);
  });

  ipcMain.handle("sync:run", async () => {
    return runSync(prisma, deviceId);
  });

  ipcMain.handle("review:due", async (_event, limit?: number) => {
    return listDueEntries(prisma, limit);
  });

  ipcMain.handle("review:rate", async (_event, vocabId: string, remembered: boolean) => {
    await rateReview(prisma, vocabId, remembered);
  });
}
