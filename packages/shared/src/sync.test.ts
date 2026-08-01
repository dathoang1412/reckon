import { describe, expect, it } from "vitest";
import { resolveConflict, type SyncChange } from "./sync";

function change(overrides: Partial<SyncChange>): SyncChange {
  return {
    kind: "task",
    id: "11111111-1111-1111-1111-111111111111",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deviceId: "device-a",
    deletedAt: null,
    data: {},
    ...overrides,
  };
}

describe("resolveConflict", () => {
  it("picks the change with the later updatedAt", () => {
    const older = change({ updatedAt: "2026-01-01T00:00:00.000Z" });
    const newer = change({ updatedAt: "2026-01-02T00:00:00.000Z" });
    expect(resolveConflict(older, newer)).toBe(newer);
    expect(resolveConflict(newer, older)).toBe(newer);
  });

  it("breaks ties on deviceId so both replicas converge", () => {
    const a = change({ deviceId: "device-a" });
    const b = change({ deviceId: "device-b" });
    expect(resolveConflict(a, b)).toBe(b);
    expect(resolveConflict(b, a)).toBe(b);
  });
});
