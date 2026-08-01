import { z } from "zod";

// Every syncable record carries these fields so the sync engine can
// order changes and resolve conflicts without touching domain fields.
export const syncMetaSchema = z.object({
  id: z.string().uuid(),
  updatedAt: z.string().datetime(),
  deviceId: z.string(),
  deletedAt: z.string().datetime().nullable().default(null),
});

export const taskSchema = syncMetaSchema.extend({
  title: z.string().min(1).max(200),
  notes: z.string().max(5000).nullable().default(null),
  done: z.boolean().default(false),
  dueDate: z.string().datetime().nullable().default(null),
});
export type Task = z.infer<typeof taskSchema>;

export const noteSchema = syncMetaSchema.extend({
  title: z.string().min(1).max(200),
  body: z.string().max(50000).default(""),
});
export type Note = z.infer<typeof noteSchema>;

export const expenseSchema = syncMetaSchema.extend({
  amount: z.number().finite(),
  currency: z.string().length(3).default("VND"),
  category: z.string().min(1).max(100),
  memo: z.string().max(500).nullable().default(null),
  spentAt: z.string().datetime(),
});
export type Expense = z.infer<typeof expenseSchema>;

export const entityKind = z.enum(["task", "note", "expense"]);
export type EntityKind = z.infer<typeof entityKind>;
