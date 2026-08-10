import { describe, expect, it } from "vitest";
import { nextReviewState, type ReviewStateInput } from "./srs";

const NOW = new Date("2026-01-01T00:00:00.000Z");

// A card that's already been reviewed a few times, used as a common
// starting point for comparing how the four ratings diverge.
const REVIEWED_STATE: ReviewStateInput = {
  stability: 15,
  difficulty: 5,
  elapsedDays: 0,
  scheduledDays: 15,
  learningSteps: 0,
  reps: 3,
  lapses: 0,
  state: 2, // Review
  dueAt: NOW,
  lastReviewedAt: new Date("2025-12-17T00:00:00.000Z"),
};

describe("nextReviewState", () => {
  it("schedules a brand-new card in the future on a good rating", () => {
    const result = nextReviewState(null, "good", NOW);
    expect(result.reps).toBe(1);
    expect(result.lapses).toBe(0);
    expect(result.stability).toBeGreaterThan(0);
    expect(result.dueAt.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("increments lapses and still schedules a future review on forgetting", () => {
    const result = nextReviewState(REVIEWED_STATE, "again", NOW);
    expect(result.lapses).toBe(REVIEWED_STATE.lapses + 1);
    expect(result.dueAt.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("does not increment lapses on non-failing ratings", () => {
    for (const rating of ["hard", "good", "easy"] as const) {
      const result = nextReviewState(REVIEWED_STATE, rating, NOW);
      expect(result.lapses).toBe(REVIEWED_STATE.lapses);
    }
  });

  it("orders the resulting due dates hard < good < easy for the same starting state", () => {
    const hard = nextReviewState(REVIEWED_STATE, "hard", NOW);
    const good = nextReviewState(REVIEWED_STATE, "good", NOW);
    const easy = nextReviewState(REVIEWED_STATE, "easy", NOW);

    expect(hard.dueAt.getTime()).toBeLessThanOrEqual(good.dueAt.getTime());
    expect(good.dueAt.getTime()).toBeLessThan(easy.dueAt.getTime());
  });

  it("always advances reps by exactly one regardless of rating", () => {
    for (const rating of ["again", "hard", "good", "easy"] as const) {
      const result = nextReviewState(REVIEWED_STATE, rating, NOW);
      expect(result.reps).toBe(REVIEWED_STATE.reps + 1);
    }
  });
});
