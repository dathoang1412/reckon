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
