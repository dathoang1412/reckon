import { contextBridge, ipcRenderer } from "electron";

const api = {
  tasks: {
    list: () => ipcRenderer.invoke("tasks:list"),
    create: (title: string) => ipcRenderer.invoke("tasks:create", title),
    toggle: (id: string) => ipcRenderer.invoke("tasks:toggle", id),
    delete: (id: string) => ipcRenderer.invoke("tasks:delete", id),
  },
  sync: {
    run: () => ipcRenderer.invoke("sync:run") as Promise<{ pushed: number; pulled: number }>,
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ReckonApi = typeof api;
