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
  targetLang: z.string().min(2).max(5),
});
export type VocabEntry = z.infer<typeof vocabEntrySchema>;

// The domain fields of a VocabEntry, without sync metadata — the shape of
// a SyncChange's `data` payload, validated at the network boundary.
export const vocabEntryDataSchema = vocabEntrySchema.omit({ id: true, updatedAt: true, deviceId: true, deletedAt: true });
export type VocabEntryData = z.infer<typeof vocabEntryDataSchema>;

export const entityKind = z.enum(["vocab"]);
export type EntityKind = z.infer<typeof entityKind>;
