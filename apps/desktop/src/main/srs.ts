// Simplified SM-2 (Anki-style), reduced to a binary "remembered / forgot"
// rating instead of the classic 0-5 quality score — keeps the flashcard UI
// to two buttons while still spacing reviews out exponentially on success.
export interface ReviewStateInput {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface ReviewStateResult extends ReviewStateInput {
  dueAt: Date;
}

const MIN_EASE_FACTOR = 1.3;
const EASE_PENALTY = 0.2;

export function nextReviewState(
  state: ReviewStateInput,
  remembered: boolean,
  now: Date = new Date(),
): ReviewStateResult {
  if (!remembered) {
    return {
      repetitions: 0,
      intervalDays: 1,
      easeFactor: Math.max(MIN_EASE_FACTOR, state.easeFactor - EASE_PENALTY),
      dueAt: addDays(now, 1),
    };
  }

  const repetitions = state.repetitions + 1;
  const intervalDays =
    repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(state.intervalDays * state.easeFactor);

  return {
    repetitions,
    intervalDays,
    easeFactor: state.easeFactor,
    dueAt: addDays(now, intervalDays),
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
