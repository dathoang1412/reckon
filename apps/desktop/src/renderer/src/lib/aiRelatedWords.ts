import type { AiRelatedWords } from "../../../preload/index";

// Defense in depth against a null/malformed item inside aiRelatedWords.forms
// — main/services/ai/ai.ts's relatedWordsContent filters these at generation
// time, but a row saved before that fix can still have bad data sitting in
// the DB. Every renderer that maps over `.forms` and reads `f.word`/`f.pos`
// unconditionally needs this, since one bad item used to crash the whole
// related-words view (VocabDetailModal/App.tsx's search preview, and
// Popup.tsx's related tab all render the same shape).
export function safeForms(forms: AiRelatedWords["forms"] | undefined | null): { pos: string; word: string }[] {
  return (forms ?? []).filter((f): f is { pos: string; word: string } => !!f && typeof f.word === "string");
}
