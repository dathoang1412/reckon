import { describe, expect, it } from "vitest";
import { nextReviewState } from "./srs";

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("nextReviewState", () => {
  it("schedules a fresh card 1 day out on first success", () => {
    const result = nextReviewState({ easeFactor: 2.5, intervalDays: 0, repetitions: 0 }, true, NOW);
    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1);
    expect(result.easeFactor).toBe(2.5);
    expect(result.dueAt).toEqual(new Date("2026-01-02T00:00:00.000Z"));
  });

  it("schedules the second success 6 days out", () => {
    const result = nextReviewState({ easeFactor: 2.5, intervalDays: 1, repetitions: 1 }, true, NOW);
    expect(result.repetitions).toBe(2);
    expect(result.intervalDays).toBe(6);
  });

  it("grows the interval by the ease factor after the second success", () => {
    const result = nextReviewState({ easeFactor: 2.5, intervalDays: 6, repetitions: 2 }, true, NOW);
    expect(result.repetitions).toBe(3);
    expect(result.intervalDays).toBe(15); // round(6 * 2.5)
  });

  it("resets to a 1-day interval and lowers ease factor on forgetting", () => {
    const result = nextReviewState({ easeFactor: 2.5, intervalDays: 15, repetitions: 3 }, false, NOW);
    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
    expect(result.easeFactor).toBe(2.3);
    expect(result.dueAt).toEqual(new Date("2026-01-02T00:00:00.000Z"));
  });

  it("floors the ease factor at 1.3 so repeated failures don't overshoot", () => {
    const result = nextReviewState({ easeFactor: 1.35, intervalDays: 1, repetitions: 0 }, false, NOW);
    expect(result.easeFactor).toBe(1.3);
  });
});
