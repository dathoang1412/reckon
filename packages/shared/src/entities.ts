import { z } from "zod";

// Every syncable record carries these fields so the sync engine can
// order changes and resolve conflicts without touching domain fields.
export const syncMetaSchema = z.object({
  id: z.string().uuid(),
  updatedAt: z.string().datetime(),
  deviceId: z.string(),
  deletedAt: z.string().datetime().nullable().default(null),
});

export const vocabEntrySchema = syncMetaSchema.extend({
  sourceText: z.string().min(1).max(500),
  sourceLang: z.string().min(2).max(5),
  targetText: z.string().min(1).max(1000),
  // Alternative meanings for the same word (targetText is always the
  // first entry). Defaults to empty for older synced records that predate
  // this field.
  targetMeanings: z.array(z.string().min(1).max(1000)).default([]),
  targetLang: z.string().min(2).max(5),
  // References a VocabSet's id — a plain string, not a relation, matching
  // this schema's loosely-coupled sync design (no cross-entity integrity
  // is enforced over the wire).
  setId: z.string().uuid().nullable().default(null),
  // When the word was first saved — a domain field (not sync meta, unlike
  // updatedAt) so it survives sync and stays stable across devices instead
  // of resetting to "now" on whichever device last pulled it.
  createdAt: z.string().datetime(),
  // Personal mnemonic/context note, user-authored.
  note: z.string().max(2000).nullable().default(null),
  // Free-form labels for filtering, independent of setId's single-folder
  // grouping. Defaults to empty for older synced records that predate this
  // field, same as targetMeanings above.
  tags: z.array(z.string().min(1).max(50)).default([]),
  // User-authored definition — most useful for words the built-in English
  // dictionary lookup found nothing for.
  definition: z.string().max(2000).nullable().default(null),
});
export type VocabEntry = z.infer<typeof vocabEntrySchema>;

// The domain fields of a VocabEntry, without sync metadata — the shape of
// a SyncChange's `data` payload, validated at the network boundary.
export const vocabEntryDataSchema = vocabEntrySchema.omit({ id: true, updatedAt: true, deviceId: true, deletedAt: true });
export type VocabEntryData = z.infer<typeof vocabEntryDataSchema>;

// A user-named grouping of VocabEntry rows (e.g. "TOEIC", "Everyday") —
// one set per entry, like folders rather than multi-tags.
export const vocabSetSchema = syncMetaSchema.extend({
  name: z.string().min(1).max(100),
});
export type VocabSet = z.infer<typeof vocabSetSchema>;

export const vocabSetDataSchema = vocabSetSchema.omit({ id: true, updatedAt: true, deviceId: true, deletedAt: true });
export type VocabSetData = z.infer<typeof vocabSetDataSchema>;

export const entityKind = z.enum(["vocab", "vocabSet"]);
export type EntityKind = z.infer<typeof entityKind>;
