import { z } from "zod";

export const authSignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});
export type AuthSignupRequest = z.infer<typeof authSignupRequestSchema>;

export const authLoginRequestSchema = authSignupRequestSchema;
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;

export const authResponseSchema = z.object({
  token: z.string(),
  email: z.string().email(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
