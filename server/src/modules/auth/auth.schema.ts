import { z } from 'zod';
import { Difficulty, StudentGrade } from '@prisma/client';

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

export const registerStudentSchema = z.object({
  firstName: z.string().min(2, 'First name is required').max(50).trim(),
  lastName: z.string().min(2, 'Last name is required').max(50).trim(),
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(8, 'Phone number must be at least 8 characters').max(20).trim().optional().or(z.literal('')),
  grade: z.nativeEnum(StudentGrade).optional(),
  programmingLevel: z.nativeEnum(Difficulty).default(Difficulty.BEGINNER).optional(),
  website: z.string().optional() // Honeypot anti-spam field (must remain empty)
});

export const verifyEmailSchema = z.object({
  userId: z.string().min(1, 'User ID is required').trim(),
  otpCode: z.string().length(6, 'Verification code must be 6 digits').regex(/^\d{6}$/, 'Verification code must be numeric')
});

export const resendVerificationSchema = z.object({
  userId: z.string().min(1, 'User ID is required').trim()
});

export const selectLearningModeSchema = z.object({
  mode: z.enum(['ONLINE', 'HYBRID'])
});

export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyAdminOtpInput = z.infer<typeof verifyAdminOtpSchema>;
export type ResendAdminOtpInput = z.infer<typeof resendAdminOtpSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SetupPasswordInput = z.infer<typeof setupPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type SelectLearningModeInput = z.infer<typeof selectLearningModeSchema>;

