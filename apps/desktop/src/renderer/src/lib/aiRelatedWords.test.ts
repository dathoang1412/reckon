import { describe, expect, it } from "vitest";
import { safeForms } from "./aiRelatedWords";

// Regression test for the popup/detail "Cannot read properties of null
// (reading 'word')" crash — a row saved before ai.ts's relatedWordsContent
// started filtering malformed items can still have bad data sitting in the
// DB, so every renderer that maps over `.forms` needs this guard too.
describe("safeForms", () => {
  it("drops null/malformed items and keeps well-formed ones", () => {
    const forms = [{ pos: "verb", word: "bind" }, null, { pos: "adjective" }, { word: "binding", pos: "noun" }];
    // @ts-expect-error — deliberately feeding malformed data, same shape
    // old persisted rows / a raw Groq response can contain.
    expect(safeForms(forms)).toEqual([
      { pos: "verb", word: "bind" },
      { word: "binding", pos: "noun" },
    ]);
  });

  it("handles null/undefined input", () => {
    expect(safeForms(null)).toEqual([]);
    expect(safeForms(undefined)).toEqual([]);
  });
});
