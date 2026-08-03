import { authResponseSchema, type AuthResponse } from "@reckon/shared";
import { setSession } from "../utils/authSession";
import { SERVER_PORT, waitForServerReady } from "./server";

const SERVER_URL = `http://localhost:${SERVER_PORT}`;

interface ServerErrorBody {
  message?: string | string[];
}

async function authRequest(path: string, email: string, password: string): Promise<AuthResponse> {
  await waitForServerReady();

  const res = await fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json: unknown = await res.json();

  if (!res.ok) {
    const body = json as ServerErrorBody;
    const message = Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? `HTTP ${res.status}`);
    throw new Error(message);
  }

  const result = authResponseSchema.parse(json);
  setSession(result.token, result.email);
  return result;
}

export function signup(email: string, password: string): Promise<AuthResponse> {
  return authRequest("/auth/signup", email, password);
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return authRequest("/auth/login", email, password);
}
