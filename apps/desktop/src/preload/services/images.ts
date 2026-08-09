import { ipcRenderer } from "electron";
import type { ImageCandidate } from "../types";

export const images = {
  search: (query: string) => ipcRenderer.invoke("images:search", query) as Promise<ImageCandidate[]>,
};
