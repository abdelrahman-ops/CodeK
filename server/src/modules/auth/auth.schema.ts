import { z } from 'zod';

export const loginSchema = z.object({
  loginId: z.string().min(1, 'Login ID or Email is required').trim(),
  password: z.string().min(1, 'Password is required')
});

export const verifyAdminOtpSchema = z.object({
  tempToken: z.string().min(1, 'Temporary 2FA token is required'),
  otpCode: z.string().length(6, 'Verification code must be 6 digits').regex(/^\d{6}$/, 'Verification code must be numeric')
});

export const resendAdminOtpSchema = z.object({
  tempToken: z.string().min(1, 'Temporary 2FA token is required')
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional() // Can come from body or HttpOnly cookie
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

export const setupPasswordSchema = z.object({
  token: z.string().min(1, 'Setup token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

export const forgotPasswordSchema = z.object({
  loginId: z.string().min(1, 'Login ID or Email is required').trim()
});

export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyAdminOtpInput = z.infer<typeof verifyAdminOtpSchema>;
export type ResendAdminOtpInput = z.infer<typeof resendAdminOtpSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SetupPasswordInput = z.infer<typeof setupPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
