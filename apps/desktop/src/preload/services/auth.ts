import { ipcRenderer } from "electron";
import type { AuthSession, UpdateProfileRequest, UserProfile } from "../types";

export const auth = {
  signup: (email: string, password: string) =>
    ipcRenderer.invoke("auth:signup", email, password) as Promise<AuthSession>,
  login: (email: string, password: string) =>
    ipcRenderer.invoke("auth:login", email, password) as Promise<AuthSession>,
  loginWithGoogle: () => ipcRenderer.invoke("auth:loginWithGoogle") as Promise<AuthSession>,
  logout: () => ipcRenderer.invoke("auth:logout") as Promise<void>,
  getSession: () => ipcRenderer.invoke("auth:getSession") as Promise<AuthSession | null>,
  getProfile: () => ipcRenderer.invoke("auth:getProfile") as Promise<UserProfile>,
  updateProfile: (patch: UpdateProfileRequest) =>
    ipcRenderer.invoke("auth:updateProfile", patch) as Promise<UserProfile>,
};
