import Store from "electron-store";

export interface Session {
  token: string;
  email: string;
}

interface AuthSchema {
  token?: string;
  email?: string;
}

// Lazy like settings.ts's Store, for the same reason (app.setName() timing).
let store: Store<AuthSchema> | null = null;

function getStore(): Store<AuthSchema> {
  if (!store) {
    store = new Store<AuthSchema>({ name: "auth" });
  }
  return store;
}

// Pure local read, no network — this is what lets the app gate on "have we
// ever logged in" at startup without requiring connectivity on every launch.
export function getSession(): Session | null {
  const { token, email } = getStore().store;
  return token && email ? { token, email } : null;
}

export function setSession(token: string, email: string): void {
  getStore().set({ token, email });
}

export function clearSession(): void {
  getStore().clear();
}
