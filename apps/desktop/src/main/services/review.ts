import type { PrismaClient, VocabEntry } from "../../../generated/client";
import { nextReviewState } from "./srs";

export interface DueEntry extends VocabEntry {
  dueAt: Date | null;
}

// A card is due if it has no review state yet (never studied) or its
// scheduled dueAt has passed. setId follows the same convention as
// setVocabEntrySet/App.tsx's activeSet: undefined = all sets, null = only
// unassigned entries, a string = only that set.
export async function listDueEntries(
  prisma: PrismaClient,
  limit = 20,
  setId?: string | null,
): Promise<DueEntry[]> {
  const now = new Date();
  const entries = await prisma.vocabEntry.findMany({
    where: { deletedAt: null, ...(setId !== undefined ? { setId } : {}) },
    orderBy: { updatedAt: "desc" },
  });

  const states = await prisma.reviewState.findMany({
    where: { vocabId: { in: entries.map((entry) => entry.id) } },
  });
  const dueAtByVocabId = new Map(states.map((state) => [state.vocabId, state.dueAt]));

  return entries
    .map((entry) => ({ ...entry, dueAt: dueAtByVocabId.get(entry.id) ?? null }))
    .filter((entry) => !entry.dueAt || entry.dueAt <= now)
    .slice(0, limit);
}

export async function rateReview(prisma: PrismaClient, vocabId: string, remembered: boolean): Promise<void> {
  const existing = await prisma.reviewState.findUnique({ where: { vocabId } });
  const next = nextReviewState(existing ?? { easeFactor: 2.5, intervalDays: 0, repetitions: 0 }, remembered);

  await prisma.reviewState.upsert({
    where: { vocabId },
    create: { vocabId, ...next },
    update: next,
  });
}
