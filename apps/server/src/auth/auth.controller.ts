import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { authLoginRequestSchema, authSignupRequestSchema } from "@reckon/shared";
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
}
