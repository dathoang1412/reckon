// Shared between ai.ts (produces these), vocab.ts (persists them as
// JSON-encoded columns), sync.ts (carries them through the sync payload),
// and the IPC layer (handlers.ts/preload) — kept in one place so all four
// agree on the exact shape instead of each re-declaring it.

export interface AiExample {
  sentence: string;
  translation: string;
}

export interface AiRelatedWords {
  synonyms: string[];
  antonyms: string[];
  forms: { pos: string; word: string }[];
}

// Result of the Ctrl+Shift+G grammar/naturalness check (see ai.ts's
// checkGrammar) — never persisted, so this only needs to agree between
// ai.ts (produces it) and the IPC layer (handlers.ts/preload) that carries
// it to the popup.
export interface GrammarCheckResult {
  original: string;
  // False when the model considers the sentence already natural/correct —
  // `corrected` is still populated in that case (equal to `original`) so
  // the renderer never has to special-case a null suggestion.
  isNatural: boolean;
  corrected: string;
  explanation: string;
}
