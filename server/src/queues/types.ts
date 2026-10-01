import { SendEmailOptions } from '../services/email/email.service.js';

// ==========================================
// EMAIL JOB TYPES & PAYLOADS
// ==========================================

export const EmailJobType = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  ADMIN_LOGIN_OTP: 'ADMIN_LOGIN_OTP',
  PASSWORD_RESET: 'PASSWORD_RESET',
  CUSTOM_MAIL: 'CUSTOM_MAIL',
} as const;

export type EmailJobType = (typeof EmailJobType)[keyof typeof EmailJobType];

export interface EmailVerificationJobData {
  type: typeof EmailJobType.EMAIL_VERIFICATION;
  email: string;
  authTokenId: string;
  studentName: string;
}

export interface AdminLoginOtpJobData {
  type: typeof EmailJobType.ADMIN_LOGIN_OTP;
  email: string;
  authTokenId: string;
  adminName: string;
}

export interface PasswordResetJobData {
  type: typeof EmailJobType.PASSWORD_RESET;
  email: string;
  authTokenId: string;
  userName: string;
}

export interface CustomMailJobData extends SendEmailOptions {
  type: typeof EmailJobType.CUSTOM_MAIL;
}

export type EmailJobData =
  | EmailVerificationJobData
  | AdminLoginOtpJobData
  | PasswordResetJobData
  | CustomMailJobData;

// ==========================================
// VIDEO JOB TYPES & PAYLOADS
// ==========================================

export const VideoJobType = {
  VIDEO_READY: 'VIDEO_READY',
  VIDEO_FAILED: 'VIDEO_FAILED',
  VIDEO_CLEANUP: 'VIDEO_CLEANUP',
} as const;

export type VideoJobType = (typeof VideoJobType)[keyof typeof VideoJobType];

export interface VideoReadyJobData {
  type: typeof VideoJobType.VIDEO_READY;
  videoAssetId: string;
  providerVideoId: string;
  playbackId?: string | null;
  durationSeconds?: number | null;
  targetLessonId?: string | null;
  replacesAssetId?: string | null;
}

export interface VideoFailedJobData {
  type: typeof VideoJobType.VIDEO_FAILED;
  videoAssetId: string;
  providerVideoId: string;
  errorMessage: string;
}

export interface VideoCleanupJobData {
  type: typeof VideoJobType.VIDEO_CLEANUP;
  provider: string;
  providerVideoId: string;
  videoAssetId?: string;
}

export type VideoJobData =
  | VideoReadyJobData
  | VideoFailedJobData
  | VideoCleanupJobData;
