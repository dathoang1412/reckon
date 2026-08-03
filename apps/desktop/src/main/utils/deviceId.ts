import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

let cachedDeviceId: string | null = null;

// One stable id per install, used to attribute local changes so the
// sync engine can order and tie-break them across devices.
export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;

  const file = path.join(app.getPath("userData"), "device-id.txt");
  if (fs.existsSync(file)) {
    cachedDeviceId = fs.readFileSync(file, "utf-8").trim();
    return cachedDeviceId;
  }

  const id = randomUUID();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, id);
  cachedDeviceId = id;
  return id;
}
