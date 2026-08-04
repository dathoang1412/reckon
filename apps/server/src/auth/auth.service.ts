import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { UpdateProfileRequest, UserProfile } from "@reckon/shared";
import { compare, hash } from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";

// No refresh-token flow exists yet, so the token is long-lived — a
// 401 from an expired/invalid token just sends the user back to login,
// see apps/desktop's runSync error handling.
const JWT_EXPIRES_IN = "365d";

// Best-effort import of a brand-new Google user's profile photo — Google's
// default-size photo is already small (typically well under the 500KB cap
// updateProfileRequestSchema enforces), so unlike user-uploaded avatars
// (resized client-side in Settings.tsx) this needs no further processing.
// Never throws: a failed fetch just means the user starts with no avatar,
// same as signing up with email/password.
async function fetchAvatarAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export interface AuthResult {
  token: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private secret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not set");
    return secret;
  }

  private sign(userId: string): string {
    return jwt.sign({ sub: userId }, this.secret(), { expiresIn: JWT_EXPIRES_IN });
  }

  async signup(email: string, password: string): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email đã được sử dụng");

    const passwordHash = await hash(password, 10);
    const user = await this.prisma.user.create({ data: { email, passwordHash } });
    return { token: this.sign(user.id), email: user.email };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Sai email hoặc mật khẩu");
    if (!user.passwordHash) {
      throw new UnauthorizedException('Tài khoản này dùng đăng nhập Google — hãy bấm "Đăng nhập với Google".');
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Sai email hoặc mật khẩu");

    return { token: this.sign(user.id), email: user.email };
  }

  private googleClientId(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set");
    return clientId;
  }

  // idToken comes from apps/desktop's main-process PKCE flow (see
  // main/services/googleAuth.ts) — verified here against Google's own
  // public keys, never trusted as-is.
  async googleLogin(idToken: string): Promise<AuthResult> {
    const clientId = this.googleClientId();
    const client = new OAuth2Client(clientId);

    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException("Google token không hợp lệ");
    }
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException("Google token thiếu thông tin cần thiết");
    }
    const { sub: googleId, email, name, picture } = payload;

    // Prefer an existing Google-linked account; fall back to linking an
    // existing email/password account with the same address (so someone
    // who signed up normally first doesn't end up with two separate
    // accounts for the same email), then finally create a fresh one.
    let user = await this.prisma.user.findUnique({ where: { googleId } });
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      // Only import Google's photo when there's no avatar already —
      // never clobber one the user picked themselves in Settings.
      const avatarBase64 =
        byEmail?.avatarBase64 ?? (picture ? await fetchAvatarAsBase64(picture) : null);
      user = byEmail
        ? await this.prisma.user.update({
            where: { id: byEmail.id },
            data: { googleId, name: byEmail.name ?? name, avatarBase64 },
          })
        : await this.prisma.user.create({ data: { email, googleId, name, avatarBase64 } });
    }

    return { token: this.sign(user.id), email: user.email };
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { email: user.email, name: user.name, avatarBase64: user.avatarBase64 };
  }

  async updateProfile(userId: string, patch: UpdateProfileRequest): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: patch.name, avatarBase64: patch.avatarBase64 },
    });
    return { email: user.email, name: user.name, avatarBase64: user.avatarBase64 };
  }

  // Returns the authenticated userId, or throws — used by AuthGuard.
  verifyToken(token: string): string {
    try {
      const payload = jwt.verify(token, this.secret());
      if (typeof payload === "string" || typeof payload.sub !== "string") {
        throw new Error("unexpected token payload shape");
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException("Token không hợp lệ hoặc đã hết hạn");
    }
  }
}
