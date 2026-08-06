import { describe, expect, it } from "vitest";
import type { VocabEntryRow } from "../../../preload/index";
import { buildDailyCounts, computeStreak } from "./ActivityChart";

function entryAt(daysAgo: number): VocabEntryRow {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { createdAt: d.toISOString() } as VocabEntryRow;
}

describe("buildDailyCounts", () => {
  it("zero-fills days with no saves instead of skipping them", () => {
    const daily = buildDailyCounts([entryAt(0), entryAt(0), entryAt(3)]);
    expect(daily).toHaveLength(14);
    expect(daily[13].count).toBe(2); // today
    expect(daily[10].count).toBe(1); // 3 days ago
    expect(daily[12].count).toBe(0); // 1 day ago, nothing saved
  });
});

describe("computeStreak", () => {
  it("counts back from today while every day has a save", () => {
    const daily = [
      { key: "a", label: "a", count: 1 },
      { key: "b", label: "b", count: 1 },
      { key: "c", label: "c", count: 1 },
    ];
    expect(computeStreak(daily)).toBe(3);
  });

  it("stops at the first empty day looking backward", () => {
    const daily = [
      { key: "a", label: "a", count: 1 },
      { key: "b", label: "b", count: 0 },
      { key: "c", label: "c", count: 1 },
    ];
    expect(computeStreak(daily)).toBe(1); // only "today" (index 2) counts
  });

  it("doesn't break the streak just because today has no save yet", () => {
    const daily = [
      { key: "a", label: "a", count: 1 },
      { key: "b", label: "b", count: 1 },
      { key: "c", label: "c", count: 0 }, // today, not over yet
    ];
    expect(computeStreak(daily)).toBe(2);
  });
});
