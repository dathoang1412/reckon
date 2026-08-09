import { authResponseSchema, userProfileSchema, type AuthResponse, type UpdateProfileRequest, type UserProfile } from "@reckon/shared";
import { getSession, setSession } from "../../utils/authSession";
import { getGoogleIdToken } from "./googleAuth";
import { SERVER_PORT, waitForServerReady } from "../system/server";

const SERVER_URL = `http://localhost:${SERVER_PORT}`;

interface ServerErrorBody {
  message?: string | string[];
}

async function parseErrorOrThrow(res: Response): Promise<unknown> {
  const json: unknown = await res.json();
  if (!res.ok) {
    const body = json as ServerErrorBody;
    const message = Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? `HTTP ${res.status}`);
    throw new Error(message);
  }
  return json;
}

async function authRequest(path: string, email: string, password: string): Promise<AuthResponse> {
  await waitForServerReady();

  const res = await fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const result = authResponseSchema.parse(await parseErrorOrThrow(res));
  setSession(result.token, result.email);
  return result;
}

export function signup(email: string, password: string): Promise<AuthResponse> {
  return authRequest("/auth/signup", email, password);
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return authRequest("/auth/login", email, password);
}

export async function loginWithGoogle(): Promise<AuthResponse> {
  const idToken = await getGoogleIdToken();
  await waitForServerReady();

  const res = await fetch(`${SERVER_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const result = authResponseSchema.parse(await parseErrorOrThrow(res));
  setSession(result.token, result.email);
  return result;
}

function authHeaders(): Record<string, string> {
  const session = getSession();
  if (!session) throw new Error("Chưa đăng nhập");
  return { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" };
}

export async function getProfile(): Promise<UserProfile> {
  await waitForServerReady();
  const res = await fetch(`${SERVER_URL}/auth/me`, { headers: authHeaders() });
  return userProfileSchema.parse(await parseErrorOrThrow(res));
}

export async function updateProfile(patch: UpdateProfileRequest): Promise<UserProfile> {
  await waitForServerReady();
  const res = await fetch(`${SERVER_URL}/auth/me`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return userProfileSchema.parse(await parseErrorOrThrow(res));
}
