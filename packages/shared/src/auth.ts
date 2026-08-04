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

export const authGoogleRequestSchema = z.object({
  idToken: z.string(),
});
export type AuthGoogleRequest = z.infer<typeof authGoogleRequestSchema>;

export const userProfileSchema = z.object({
  email: z.string().email(),
  name: z.string().nullable(),
  // A data: URI (see apps/desktop's Settings.tsx, which resizes/compresses
  // client-side before ever sending one) — capped well above what a
  // reasonably-compressed small avatar needs, just to keep a malformed
  // client from writing something absurd into Postgres.
  avatarBase64: z.string().max(500_000).nullable(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateProfileRequestSchema = z.object({
  name: z.string().min(1).max(100).nullable().optional(),
  avatarBase64: z.string().max(500_000).nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
