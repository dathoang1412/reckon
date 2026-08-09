import { contextBridge } from "electron";
import { ai } from "./services/ai";
import { auth } from "./services/auth";
import { review } from "./services/review";
import { settings } from "./services/settings";
import { app, log, popup, sync, tts, updater } from "./services/system";
import { dictionary, vocab, vocabSet } from "./services/vocab";
import { events } from "./events";

export * from "./types";

const api = {
  vocab,
  vocabSet,
  dictionary,
  tts,
  sync,
  auth,
  review,
  settings,
  ai,
  popup,
  app,
  log,
  updater,
  ...events,
};

contextBridge.exposeInMainWorld("api", api);

export type ReckonApi = typeof api;
