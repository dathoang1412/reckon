import { shell } from "electron";
import { createHash, randomBytes } from "node:crypto";
import http from "node:http";

// The "loopback IP address" flow Google's own docs prescribe for
// installed/desktop apps — no public redirect URI to register, no
// custom protocol handler; a throwaway local HTTP server on an OS-assigned
// port catches the one redirect and shuts itself down.
// https://developers.google.com/identity/protocols/oauth2/native-app
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const REDIRECT_HOST = "127.0.0.1";
const CALLBACK_TIMEOUT_MS = 120_000;

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(bytes: number): string {
  return base64url(randomBytes(bytes));
}

function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken(32);
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function successPage(ok: boolean): string {
  const heading = ok ? "Đăng nhập thành công!" : "Đăng nhập thất bại";
  const body = ok ? "Bạn có thể đóng tab này và quay lại ứng dụng Reckon." : "Đóng tab này và thử lại trong Reckon.";
  return `<html><body style="font-family:system-ui,sans-serif;text-align:center;padding-top:80px;color:#222"><h2>${heading}</h2><p>${body}</p></body></html>`;
}

// Listens on an OS-assigned loopback port for exactly one Google redirect,
// validates the CSRF state token, then closes itself — resolves the
// authorization code (or rejects) once that single request lands.
function startLoopbackServer(expectedState: string): Promise<{ port: number; code: Promise<string> }> {
  return new Promise((resolveServer, rejectServer) => {
    let resolveCode!: (code: string) => void;
    let rejectCode!: (err: Error) => void;
    const code = new Promise<string>((res, rej) => {
      resolveCode = res;
      rejectCode = rej;
    });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${REDIRECT_HOST}`);
      const state = url.searchParams.get("state");
      const authCode = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      const ok = !!authCode && state === expectedState;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(successPage(ok));

      if (ok) {
        resolveCode(authCode!);
      } else if (state !== expectedState) {
        rejectCode(new Error("Phản hồi từ Google không hợp lệ (state không khớp)"));
      } else {
        rejectCode(new Error(error ?? "Không nhận được mã xác thực từ Google"));
      }
      // Give the response a moment to actually flush to the browser before
      // tearing the listener down.
      setTimeout(() => server.close(), 500);
    });

    server.on("error", rejectServer);
    server.listen(0, REDIRECT_HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        rejectServer(new Error("Không thể khởi động server cục bộ cho đăng nhập Google"));
        return;
      }
      resolveServer({ port: address.port, code });
    });
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

// Drives the whole PKCE flow and returns a Google-issued ID token — the
// server (apps/server's AuthController#google) verifies it independently
// against Google's public keys, so nothing here needs to be trusted beyond
// "this is what Google's token endpoint handed back".
export async function getGoogleIdToken(): Promise<string> {
  // Baked in at build time via electron.vite.config.ts's `define` (from
  // apps/desktop/.env's MAIN_VITE_GOOGLE_CLIENT_ID/SECRET — see that
  // config file for why this goes through process.env rather than
  // import.meta.env here specifically).
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Đăng nhập Google chưa được cấu hình trong bản build này.");
  }

  const { verifier, challenge } = generatePkcePair();
  const state = randomToken(16);

  const { port, code } = await startLoopbackServer(state);
  const redirectUri = `http://${REDIRECT_HOST}:${port}/`;

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  // Always show the account chooser — otherwise Google silently reuses
  // whichever Google account the system browser last signed into, which is
  // surprising if that isn't the one the user meant to use here.
  authUrl.searchParams.set("prompt", "select_account");

  await shell.openExternal(authUrl.toString());

  const authCode = await withTimeout(code, CALLBACK_TIMEOUT_MS, "Hết thời gian chờ đăng nhập Google.");

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: authCode,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const tokenJson = (await tokenRes.json()) as {
    id_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!tokenRes.ok || !tokenJson.id_token) {
    throw new Error(tokenJson.error_description ?? tokenJson.error ?? "Không lấy được token từ Google");
  }
  return tokenJson.id_token;
}
