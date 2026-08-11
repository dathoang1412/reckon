import type { PrismaClient, ReviewState, VocabEntry } from "../../../../generated/client";
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

// Wire-safe copy of a ReviewState row (Date -> ISO string) so it can travel
// over IPC and later be handed back to undoReview() to restore the exact
// pre-rating state — see Review.tsx's Ctrl+Z handling.
export interface ReviewStateSnapshot {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  dueAt: string;
  lastReviewedAt: string | null;
}

function toSnapshot(state: ReviewState): ReviewStateSnapshot {
  return {
    stability: state.stability,
    difficulty: state.difficulty,
    elapsedDays: state.elapsedDays,
    scheduledDays: state.scheduledDays,
    learningSteps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    dueAt: state.dueAt.toISOString(),
    lastReviewedAt: state.lastReviewedAt ? state.lastReviewedAt.toISOString() : null,
  };
}

// Returns the row's state from just before this rating was applied (or null
// if the card had never been reviewed before), so the caller can pass it to
// undoReview() to revert this exact rating.
export async function rateReview(
  prisma: PrismaClient,
  vocabId: string,
  rating: ReviewRating,
): Promise<ReviewStateSnapshot | null> {
  const existing = await prisma.reviewState.findUnique({ where: { vocabId } });
  const next = nextReviewState(existing, rating);

  await prisma.reviewState.upsert({
    where: { vocabId },
    create: { vocabId, ...next },
    update: next,
  });

  return existing ? toSnapshot(existing) : null;
}

// Reverts a rateReview() call using the snapshot it returned — `null` means
// the card had no ReviewState row before that rating (first-ever review), so
// undo removes the row entirely instead of restoring one.
export async function undoReview(
  prisma: PrismaClient,
  vocabId: string,
  previous: ReviewStateSnapshot | null,
): Promise<void> {
  if (!previous) {
    await prisma.reviewState.delete({ where: { vocabId } });
    return;
  }
  await prisma.reviewState.update({
    where: { vocabId },
    data: {
      ...previous,
      dueAt: new Date(previous.dueAt),
      lastReviewedAt: previous.lastReviewedAt ? new Date(previous.lastReviewedAt) : null,
    },
  });
}

// The FSRS numbers for a single word — null if it's never been reviewed
// (no ReviewState row yet). Powers the small "FSRS" summary badge on
// VocabDetailModal.
export async function getReviewState(prisma: PrismaClient, vocabId: string): Promise<ReviewStateSnapshot | null> {
  const state = await prisma.reviewState.findUnique({ where: { vocabId } });
  return state ? toSnapshot(state) : null;
}

export interface ReviewStateCounts {
  // "new" counts both cards with no ReviewState row (never studied) and, for
  // safety, any row that still reports ts-fsrs's New(0) enum value — in
  // practice nextReviewState() always advances a card out of New on its
  // first rating, but a row lingering at New would otherwise vanish from
  // every bucket.
  new: number;
  learning: number;
  review: number;
  relearning: number;
}

export interface ForecastBucket {
  // Local calendar-day key, e.g. "2026-8-12" — matches renderer/components/
  // ActivityChart.tsx's bucket-key convention (not zero-padded ISO) since
  // both are built from plain `Date` getters, not string parsing.
  key: string;
  label: string;
  count: number;
}

const FORECAST_DAYS = 14;

export interface ReviewStats {
  totalVocab: number;
  // Cards due right now, using the same "no state or dueAt <= now" gate as
  // listDueEntries — i.e. exactly what the Ôn tập queue would show.
  dueNow: number;
  stateCounts: ReviewStateCounts;
  // Both null when no card has ever been reviewed yet (nothing to average).
  avgStability: number | null;
  avgDifficulty: number | null;
  totalReps: number;
  totalLapses: number;
  // Upcoming due counts for the next FORECAST_DAYS days (today included),
  // excluding cards already due now (those are in dueNow instead).
  forecast: ForecastBucket[];
}

export async function getReviewStats(prisma: PrismaClient): Promise<ReviewStats> {
  const vocabIds = (await prisma.vocabEntry.findMany({ where: { deletedAt: null }, select: { id: true } })).map(
    (e) => e.id,
  );
  const states = await prisma.reviewState.findMany({ where: { vocabId: { in: vocabIds } } });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const forecastBuckets: ForecastBucket[] = [];
  for (let i = 0; i < FORECAST_DAYS; i++) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() + i);
    forecastBuckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      label: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
      count: 0,
    });
  }
  const forecastByKey = new Map(forecastBuckets.map((b) => [b.key, b]));

  const stateCounts: ReviewStateCounts = {
    new: vocabIds.length - states.length,
    learning: 0,
    review: 0,
    relearning: 0,
  };
  let dueNow = stateCounts.new;
  let stabilitySum = 0;
  let difficultySum = 0;
  let totalReps = 0;
  let totalLapses = 0;

  for (const s of states) {
    totalReps += s.reps;
    totalLapses += s.lapses;
    stabilitySum += s.stability;
    difficultySum += s.difficulty;

    if (s.state === 1) stateCounts.learning++;
    else if (s.state === 2) stateCounts.review++;
    else if (s.state === 3) stateCounts.relearning++;
    else stateCounts.new++;

    if (s.dueAt <= now) {
      dueNow++;
    } else {
      const key = `${s.dueAt.getFullYear()}-${s.dueAt.getMonth()}-${s.dueAt.getDate()}`;
      const bucket = forecastByKey.get(key);
      if (bucket) bucket.count++;
    }
  }

  return {
    totalVocab: vocabIds.length,
    dueNow,
    stateCounts,
    avgStability: states.length ? stabilitySum / states.length : null,
    avgDifficulty: states.length ? difficultySum / states.length : null,
    totalReps,
    totalLapses,
    forecast: forecastBuckets,
  };
}
