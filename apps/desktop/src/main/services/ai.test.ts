import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/settings", () => ({
  getGroqApiKey: () => "fake-key",
}));

import { previewRelatedWords } from "./ai";

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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                // "antonyms" omitted, as Groq sometimes does for a word
                // like "binding" that has no clean antonym.
                content: JSON.stringify({
                  synonyms: ["obligatory", "compulsory"],
                  forms: [{ pos: "verb", word: "bind" }],
                }),
              },
            },
          ],
        }),
      }),
    );

    const result = await previewRelatedWords("binding", "en", "ràng buộc", "vi");

    expect(result.synonyms).toEqual(["obligatory", "compulsory"]);
    expect(result.antonyms).toEqual([]);
    expect(result.forms).toEqual([{ pos: "verb", word: "bind" }]);
  });
});
