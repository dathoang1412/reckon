import { BadRequestException, Body, Controller, Get, Patch, Post, Req, UseGuards } from "@nestjs/common";
import {
  authGoogleRequestSchema,
  authLoginRequestSchema,
  authSignupRequestSchema,
  updateProfileRequestSchema,
  type UserProfile,
} from "@reckon/shared";
import { AuthGuard, type AuthenticatedRequest } from "./auth.guard";
import { AuthService, type AuthResult } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  async signup(@Body() body: unknown): Promise<AuthResult> {
    const parsed = authSignupRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.signup(parsed.data.email, parsed.data.password);
  }

  @Post("login")
  async login(@Body() body: unknown): Promise<AuthResult> {
    const parsed = authLoginRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.login(parsed.data.email, parsed.data.password);
  }

  @Post("google")
  async google(@Body() body: unknown): Promise<AuthResult> {
    const parsed = authGoogleRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.googleLogin(parsed.data.idToken);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  async me(@Req() req: AuthenticatedRequest): Promise<UserProfile> {
    return this.authService.getProfile(req.userId);
  }

  @Patch("me")
  @UseGuards(AuthGuard)
  async updateMe(@Req() req: AuthenticatedRequest, @Body() body: unknown): Promise<UserProfile> {
    const parsed = updateProfileRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.updateProfile(req.userId, parsed.data);
  }
}
