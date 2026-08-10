import { ipcRenderer } from "electron";
import type { DueEntryRow, ReviewRating } from "../types";

export const review = {
  // limit: null means no cap — review every entry currently due, not
  // just the first `limit` of them (see Review.tsx's word-limit selector).
  // from/to (ISO date strings): when set, review by a specific saved date
  // instead of by what's due — see Review.tsx's date filter and
  // main/services/review/review.ts's listDueEntries for the bypass-the-due-gate
  // behavior this triggers.
  due: (limit?: number | null, setId?: string | null, from?: string, to?: string) =>
    ipcRenderer.invoke("review:due", limit, setId, from, to) as Promise<DueEntryRow[]>,
  rate: (vocabId: string, rating: ReviewRating) =>
    ipcRenderer.invoke("review:rate", vocabId, rating) as Promise<void>,
};
