import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";

// No refresh-token flow exists yet, so the token is long-lived — a
// 401 from an expired/invalid token just sends the user back to login,
// see apps/desktop's runSync error handling.
const JWT_EXPIRES_IN = "365d";

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

    const valid = await compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Sai email hoặc mật khẩu");

    return { token: this.sign(user.id), email: user.email };
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
