import { ipcRenderer } from "electron";
import type { TranslateDirection } from "../types";

export const settings = {
  getHotkey: () => ipcRenderer.invoke("settings:getHotkey") as Promise<string>,
  setHotkey: (accelerator: string) => ipcRenderer.invoke("settings:setHotkey", accelerator) as Promise<boolean>,
  getSearchHotkey: () => ipcRenderer.invoke("settings:getSearchHotkey") as Promise<string>,
  setSearchHotkey: (accelerator: string) =>
    ipcRenderer.invoke("settings:setSearchHotkey", accelerator) as Promise<boolean>,
  getGrammarHotkey: () => ipcRenderer.invoke("settings:getGrammarHotkey") as Promise<string>,
  setGrammarHotkey: (accelerator: string) =>
    ipcRenderer.invoke("settings:setGrammarHotkey", accelerator) as Promise<boolean>,
  getGroqApiKey: () => ipcRenderer.invoke("settings:getGroqApiKey") as Promise<string>,
  setGroqApiKey: (key: string) => ipcRenderer.invoke("settings:setGroqApiKey", key) as Promise<void>,
  hasGroqApiKey: () => ipcRenderer.invoke("settings:hasGroqApiKey") as Promise<boolean>,
  testGroqApiKey: (key: string) => ipcRenderer.invoke("settings:testGroqApiKey", key) as Promise<void>,
  getAutoSave: () => ipcRenderer.invoke("settings:getAutoSave") as Promise<boolean>,
  setAutoSave: (value: boolean) => ipcRenderer.invoke("settings:setAutoSave", value) as Promise<void>,
  getTranslateDirection: () => ipcRenderer.invoke("settings:getTranslateDirection") as Promise<TranslateDirection>,
  setTranslateDirection: (value: TranslateDirection) =>
    ipcRenderer.invoke("settings:setTranslateDirection", value) as Promise<void>,
  getReviewLimit: () => ipcRenderer.invoke("settings:getReviewLimit") as Promise<number | null>,
  setReviewLimit: (value: number | null) => ipcRenderer.invoke("settings:setReviewLimit", value) as Promise<void>,
  getDarkMode: () => ipcRenderer.invoke("settings:getDarkMode") as Promise<boolean>,
  setDarkMode: (value: boolean) => ipcRenderer.invoke("settings:setDarkMode", value) as Promise<void>,
};
