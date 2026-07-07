import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginPayload = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshPayload = z.infer<typeof refreshSchema>;

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
});
export type ApiKeyCreatePayload = z.infer<typeof apiKeyCreateSchema>;

export const mfaVerifySchema = z.object({
  mfaChallengeToken: z.string(),
  token: z.string().length(6).regex(/^\d{6}$/),
});
export type MfaVerifyPayload = z.infer<typeof mfaVerifySchema>;

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
});
export type RegisterPayload = z.infer<typeof registerSchema>;
