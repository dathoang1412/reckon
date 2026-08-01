import { z } from "zod";
import { entityKind } from "./entities";

// One row in the change log a client pushes to the server, or the
// server returns to a client, during a sync round.
export const syncChangeSchema = z.object({
  kind: entityKind,
  id: z.string().uuid(),
  updatedAt: z.string().datetime(),
  deviceId: z.string(),
  deletedAt: z.string().datetime().nullable(),
  data: z.record(z.string(), z.unknown()),
});
export type SyncChange = z.infer<typeof syncChangeSchema>;

export const syncPushRequestSchema = z.object({
  deviceId: z.string(),
  changes: z.array(syncChangeSchema),
});
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;

export const syncPullRequestSchema = z.object({
  deviceId: z.string(),
  since: z.string().datetime().nullable(),
});
export type SyncPullRequest = z.infer<typeof syncPullRequestSchema>;

export const syncPullResponseSchema = z.object({
  changes: z.array(syncChangeSchema),
  serverTime: z.string().datetime(),
});
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;

// Last-write-wins: the change with the later updatedAt wins; ties
// break on deviceId so every replica resolves them identically.
export function resolveConflict(a: SyncChange, b: SyncChange): SyncChange {
  if (a.updatedAt !== b.updatedAt) {
    return a.updatedAt > b.updatedAt ? a : b;
  }
  return a.deviceId >= b.deviceId ? a : b;
}
