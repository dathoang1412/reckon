import { createEmptyCard, fsrs, Rating, type Card, type Grade, type State } from "ts-fsrs";

// Wire-safe rating vocabulary — a plain string union (not ts-fsrs's Rating
// enum) so it can be declared independently in preload/types.ts without
// the preload boundary importing ts-fsrs or any main-process type.
export type ReviewRating = "again" | "hard" | "good" | "easy";

const RATING_MAP: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

// Mirrors ts-fsrs's Card shape field-for-field (see schema.prisma's
// ReviewState model) so a row can be handed to/from ts-fsrs with just a
// rename, no value transformation.
export interface ReviewStateInput {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
}

export type ReviewStateResult = ReviewStateInput;

const scheduler = fsrs();

// state = null means "never reviewed" -> start from a fresh FSRS card
// (via createEmptyCard) instead of a zeroed-out ReviewStateInput, so
// brand-new cards get FSRS's own initial stability/difficulty rather than
// literal zeros.
export function nextReviewState(
  state: ReviewStateInput | null,
  rating: ReviewRating,
  now: Date = new Date(),
): ReviewStateResult {
  const card: Card = state
    ? {
        due: state.dueAt,
        stability: state.stability,
        difficulty: state.difficulty,
        elapsed_days: state.elapsedDays,
        scheduled_days: state.scheduledDays,
        learning_steps: state.learningSteps,
        reps: state.reps,
        lapses: state.lapses,
        state: state.state as State,
        last_review: state.lastReviewedAt ?? undefined,
      }
    : createEmptyCard(now);

  const { card: next } = scheduler.next(card, now, RATING_MAP[rating]);

  return {
    stability: next.stability,
    difficulty: next.difficulty,
    elapsedDays: next.elapsed_days,
    scheduledDays: next.scheduled_days,
    learningSteps: next.learning_steps,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    dueAt: next.due,
    lastReviewedAt: next.last_review ?? now,
  };
}
