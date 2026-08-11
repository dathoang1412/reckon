import { ipcRenderer } from "electron";
import type { DueEntryRow, ReviewRating, ReviewStats, ReviewStateSnapshot } from "../types";

export const review = {
  // limit: null means no cap — review every entry currently due, not
  // just the first `limit` of them (see Review.tsx's word-limit selector).
  // from/to (ISO date strings): when set, review by a specific saved date
  // instead of by what's due — see Review.tsx's date filter and
  // main/services/review/review.ts's listDueEntries for the bypass-the-due-gate
  // behavior this triggers.
  due: (limit?: number | null, setId?: string | null, from?: string, to?: string) =>
    ipcRenderer.invoke("review:due", limit, setId, from, to) as Promise<DueEntryRow[]>,
  // Returns the card's pre-rating ReviewState snapshot (null if it had never
  // been reviewed before) — pass it to undo() to revert this exact rating.
  rate: (vocabId: string, rating: ReviewRating) =>
    ipcRenderer.invoke("review:rate", vocabId, rating) as Promise<ReviewStateSnapshot | null>,
  undo: (vocabId: string, previous: ReviewStateSnapshot | null) =>
    ipcRenderer.invoke("review:undo", vocabId, previous) as Promise<void>,
  // The FSRS numbers for a single word — null if it's never been reviewed.
  state: (vocabId: string) => ipcRenderer.invoke("review:state", vocabId) as Promise<ReviewStateSnapshot | null>,
  // Aggregate FSRS stats across the whole vocab list — see pages/Stats.tsx.
  stats: () => ipcRenderer.invoke("review:stats") as Promise<ReviewStats>,
};
