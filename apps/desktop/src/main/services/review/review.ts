import type { PrismaClient, VocabEntry } from "../../../../generated/client";
import { nextReviewState, type ReviewRating } from "./srs";

export interface DueEntry extends VocabEntry {
  dueAt: Date | null;
}

// A card is due if it has no review state yet (never studied) or its
// scheduled dueAt has passed. setId follows the same convention as
// setVocabEntrySet/App.tsx's activeSet: undefined = all sets, null = only
// unassigned entries, a string = only that set. limit follows the same
// null-means-"no cap" convention as settings.ts's reviewLimit — null
// reviews every due entry instead of stopping at a count, for "ôn hết của
// ngày đó" (Review.tsx's word-limit selector).
//
// dateRange, when given, picks an ad-hoc study session instead of the
// normal due-queue: it filters to entries saved within that range and
// **skips the due-gate entirely** (returns them regardless of dueAt) — so
// picking "hôm qua" always shows yesterday's words to drill, even ones not
// due for review yet, rather than risking an empty list. Without a
// dateRange, behavior is unchanged.
export async function listDueEntries(
  prisma: PrismaClient,
  limit: number | null = 20,
  setId?: string | null,
  dateRange?: { from?: Date; to?: Date },
): Promise<DueEntry[]> {
  const now = new Date();
  const entries = await prisma.vocabEntry.findMany({
    where: {
      deletedAt: null,
      ...(setId !== undefined ? { setId } : {}),
      ...(dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const states = await prisma.reviewState.findMany({
    where: { vocabId: { in: entries.map((entry) => entry.id) } },
  });
  const dueAtByVocabId = new Map(states.map((state) => [state.vocabId, state.dueAt]));

  const withDueAt = entries.map((entry) => ({ ...entry, dueAt: dueAtByVocabId.get(entry.id) ?? null }));
  const due = dateRange ? withDueAt : withDueAt.filter((entry) => !entry.dueAt || entry.dueAt <= now);

  return limit === null ? due : due.slice(0, limit);
}

export async function rateReview(prisma: PrismaClient, vocabId: string, rating: ReviewRating): Promise<void> {
  const existing = await prisma.reviewState.findUnique({ where: { vocabId } });
  const next = nextReviewState(existing, rating);

  await prisma.reviewState.upsert({
    where: { vocabId },
    create: { vocabId, ...next },
    update: next,
  });
}
