import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "./translate";

// Minimal shape translateWithGoogle needs: [segments, dictionaryEntries, ...].
const GOOGLE_RESPONSE = [[["translated", "original"]], null];

function mockFetchCapturingUrl() {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      return { ok: true, json: async () => GOOGLE_RESPONSE } as Response;
    }),
  );
  return calls;
}

function langParams(url: string): { sl: string | null; tl: string | null } {
  const parsed = new URL(url);
  return { sl: parsed.searchParams.get("sl"), tl: parsed.searchParams.get("tl") };
}

// Regression coverage for the manual EN<->VI override (see settings.ts's
// TranslateDirection / TranslateDirectionToggle.tsx) — direction must win
// over the diacritics-based auto-detect, in both directions, and "auto"
// must keep behaving exactly as before.
describe("translate direction override", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forces vi->en even for text with no Vietnamese diacritics", async () => {
    const calls = mockFetchCapturingUrl();
    await translate("hello", "vi-en");
    expect(langParams(calls[0])).toEqual({ sl: "vi", tl: "en" });
  });

  it("forces en->vi even for text with Vietnamese diacritics", async () => {
    const calls = mockFetchCapturingUrl();
    await translate("chào", "en-vi");
    expect(langParams(calls[0])).toEqual({ sl: "en", tl: "vi" });
  });

  it("auto still detects vi->en from diacritics, unchanged", async () => {
    const calls = mockFetchCapturingUrl();
    await translate("chào");
    expect(langParams(calls[0])).toEqual({ sl: "vi", tl: "en" });
  });

  it("auto still detects en->vi for plain text, unchanged", async () => {
    const calls = mockFetchCapturingUrl();
    await translate("hello");
    expect(langParams(calls[0])).toEqual({ sl: "en", tl: "vi" });
  });
});
