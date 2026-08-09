import { describe, expect, it } from "vitest";
import { listDueEntries } from "./review";

// Duck-typed Prisma stub — listDueEntries only ever calls these two
// findMany methods, so a full PrismaClient isn't needed to exercise its
// due-filtering/limit logic in isolation.
function fakePrisma(entryCount: number) {
  const entries = Array.from({ length: entryCount }, (_, i) => ({
    id: `v${i}`,
    deletedAt: null,
    setId: null,
  }));
  return {
    vocabEntry: { findMany: async () => entries },
    // No ReviewState rows -> every entry counts as "never studied", i.e. due.
    reviewState: { findMany: async () => [] },
  } as unknown as Parameters<typeof listDueEntries>[0];
}

// Regression coverage for Review.tsx's word-limit selector (see
// settings.ts's reviewLimit) — limit: null must mean "no cap" (ôn hết
// những từ đến hạn), not fall back to some default via a JS default
// parameter, which is exactly the bug a `limit = 20` default parameter
// would reintroduce for an explicit `null` argument.
describe("listDueEntries", () => {
  it("caps to the given limit", async () => {
    const due = await listDueEntries(fakePrisma(30), 10);
    expect(due).toHaveLength(10);
  });

  it("returns every due entry when limit is null", async () => {
    const due = await listDueEntries(fakePrisma(30), null);
    expect(due).toHaveLength(30);
  });

  it("defaults to 20 when limit is omitted", async () => {
    const due = await listDueEntries(fakePrisma(30));
    expect(due).toHaveLength(20);
  });
});
