import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/settings", () => ({
  getGroqApiKey: () => "fake-key",
}));

import { checkGrammar, previewRelatedWords } from "./ai";

function mockGroqResponse(content: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    }),
  );
}

// Regression test for a real popup crash: Groq's response_format:json_object
// only guarantees syntactically valid JSON, not that every requested field
// is present. A word with no obvious antonym (e.g. "binding") can come back
// missing that key, and the renderer used to do `.antonyms.length`
// unconditionally — normalize() in ai.ts must fill in the gaps so callers
// always get full arrays.
describe("previewRelatedWords", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fills in a missing field instead of returning it undefined", async () => {
    // "antonyms" omitted, as Groq sometimes does for a word like "binding"
    // that has no clean antonym.
    mockGroqResponse({
      synonyms: ["obligatory", "compulsory"],
      forms: [{ pos: "verb", word: "bind" }],
    });

    const result = await previewRelatedWords("binding", "en", "ràng buộc", "vi");

    expect(result.synonyms).toEqual(["obligatory", "compulsory"]);
    expect(result.antonyms).toEqual([]);
    expect(result.forms).toEqual([{ pos: "verb", word: "bind" }]);
  });

  // Regression test for the popup/detail "Cannot read properties of null
  // (reading 'word')" crash: a *present* forms array could still contain a
  // null or malformed item — the array-level `?? []` fix above doesn't
  // catch that, since the array itself isn't missing. The renderer used to
  // do `f.word`/`f.pos` on every item unconditionally.
  it("drops null/malformed items instead of returning them as-is", async () => {
    mockGroqResponse({
      synonyms: ["obligatory", null, "  ", "compulsory"],
      antonyms: ["optional"],
      forms: [{ pos: "verb", word: "bind" }, null, { pos: "adjective" }, "not an object"],
    });

    const result = await previewRelatedWords("binding", "en", "ràng buộc", "vi");

    expect(result.synonyms).toEqual(["obligatory", "compulsory"]);
    expect(result.antonyms).toEqual(["optional"]);
    expect(result.forms).toEqual([{ pos: "verb", word: "bind" }]);
  });
});

describe("checkGrammar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults missing fields instead of leaving them undefined", async () => {
    // "explanation" omitted — same class of gap as relatedWordsContent's
    // missing "antonyms" above; every field must come back usable.
    mockGroqResponse({ isNatural: false, corrected: "I have been living here for three years." });

    const result = await checkGrammar("I am living here since three years.");

    expect(result.original).toBe("I am living here since three years.");
    expect(result.isNatural).toBe(false);
    expect(result.corrected).toBe("I have been living here for three years.");
    expect(result.explanation).toBe("");
  });

  it("falls back to the original sentence when corrected is missing", async () => {
    mockGroqResponse({ isNatural: true });

    const result = await checkGrammar("Câu này đã ổn rồi.");

    expect(result.corrected).toBe("Câu này đã ổn rồi.");
  });
});
