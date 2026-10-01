import { Queue } from 'bullmq';
import { EMAIL_QUEUE } from '../queue-names.js';
import { getOrCreateQueue } from '../queue-factory.js';
import {
  EmailJobData,
  EmailJobType,
  EmailVerificationJobData,
  AdminLoginOtpJobData,
  PasswordResetJobData,
  CustomMailJobData,
} from '../types.js';
import { emailService, SendEmailOptions } from '../../services/email/email.service.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { decryptDeliverySecret } from '../../utils/crypto-delivery.js';

export class QueueServiceUnavailableError extends Error {
  statusCode = 503;
  code = 'QUEUE_UNAVAILABLE';
  constructor(message: string) {
    super(message);
    this.name = 'QueueServiceUnavailableError';
  }
}

export class EmailQueue {
  private queue: Queue<EmailJobData>;

  constructor() {
    this.queue = getOrCreateQueue<EmailJobData>(EMAIL_QUEUE);
  }

  /**
   * Enqueues an email verification OTP job using non-secret reference.
   * Job payload contains ONLY non-secret identifiers (authTokenId).
   */
  async enqueueEmailVerification(payload: {
    email: string;
    authTokenId: string;
    studentName: string;
  }): Promise<string | null> {
    const jobData: EmailVerificationJobData = {
      type: EmailJobType.EMAIL_VERIFICATION,
      email: payload.email,
      authTokenId: payload.authTokenId,
      studentName: payload.studentName,
    };

    // Deterministic job ID per token record allows legitimate resends
    // (which create new token IDs) while deduplicating network retries
    const jobId = `verify_${payload.authTokenId}`;

    try {
      const job = await this.queue.add(EmailJobType.EMAIL_VERIFICATION, jobData, {
        jobId,
      });
      return job.id || null;
    } catch (err: any) {
      if (env.NODE_ENV === 'production') {
        // Strict production rule: never silently hide infrastructure failures
        console.error(`[EmailQueue] Production Redis failure enqueueing verification email:`, err.message);
        throw new QueueServiceUnavailableError('Queue service unavailable: failed to enqueue verification email');
      }

      // Development/test isolated fallback
      console.warn(`[EmailQueue] (DEV/TEST ONLY) Redis unavailable, delivering verification email directly:`, err.message);
      await this.executeDirectVerificationFallback(payload);
      return 'fallback_direct';
    }
  }

  /**
   * Enqueues an Admin 2FA Login OTP job using non-secret reference.
   */
  async enqueueAdminLoginOtp(payload: {
    email: string;
    authTokenId: string;
    adminName: string;
  }): Promise<string | null> {
    const jobData: AdminLoginOtpJobData = {
      type: EmailJobType.ADMIN_LOGIN_OTP,
      email: payload.email,
      authTokenId: payload.authTokenId,
      adminName: payload.adminName,
    };

    const jobId = `admin_otp_${payload.authTokenId}`;

    try {
      const job = await this.queue.add(EmailJobType.ADMIN_LOGIN_OTP, jobData, {
        jobId,
      });
      return job.id || null;
    } catch (err: any) {
      if (env.NODE_ENV === 'production') {
        console.error(`[EmailQueue] Production Redis failure enqueueing admin OTP:`, err.message);
        throw new QueueServiceUnavailableError('Queue service unavailable: failed to enqueue admin OTP');
      }

      console.warn(`[EmailQueue] (DEV/TEST ONLY) Redis unavailable, delivering admin OTP directly:`, err.message);
      await this.executeDirectAdminOtpFallback(payload);
      return 'fallback_direct';
    }
  }

  /**
   * Enqueues a Password Reset email job using non-secret reference.
   */
  async enqueuePasswordReset(payload: {
    email: string;
    authTokenId: string;
    userName: string;
  }): Promise<string | null> {
    const jobData: PasswordResetJobData = {
      type: EmailJobType.PASSWORD_RESET,
      email: payload.email,
      authTokenId: payload.authTokenId,
      userName: payload.userName,
    };

    const jobId = `reset_${payload.authTokenId}`;

    try {
      const job = await this.queue.add(EmailJobType.PASSWORD_RESET, jobData, {
        jobId,
      });
      return job.id || null;
    } catch (err: any) {
      if (env.NODE_ENV === 'production') {
        console.error(`[EmailQueue] Production Redis failure enqueueing password reset:`, err.message);
        throw new QueueServiceUnavailableError('Queue service unavailable: failed to enqueue password reset');
      }

      console.warn(`[EmailQueue] (DEV/TEST ONLY) Redis unavailable, delivering password reset directly:`, err.message);
      await this.executeDirectPasswordResetFallback(payload);
      return 'fallback_direct';
    }
  }

  /**
   * Enqueues a generic transactional email job (non-secret announcements).
   */
  async enqueueCustomMail(payload: SendEmailOptions): Promise<string | null> {
    const jobData: CustomMailJobData = {
      ...payload,
      type: EmailJobType.CUSTOM_MAIL,
    };

    try {
      const job = await this.queue.add(EmailJobType.CUSTOM_MAIL, jobData);
      return job.id || null;
    } catch (err: any) {
      if (env.NODE_ENV === 'production') {
        console.error(`[EmailQueue] Production Redis failure enqueueing custom mail:`, err.message);
        throw new QueueServiceUnavailableError('Queue service unavailable: failed to enqueue custom mail');
      }

      console.warn(`[EmailQueue] (DEV/TEST ONLY) Redis unavailable, delivering custom mail directly:`, err.message);
      await emailService.sendMail(payload);
      return 'fallback_direct';
    }
  }

  getRawQueue(): Queue<EmailJobData> {
    return this.queue;
  }

  // ==========================================
  // DEV/TEST ONLY ISOLATED FALLBACK HELPERS
  // ==========================================

  private async executeDirectVerificationFallback(payload: {
    email: string;
    authTokenId: string;
    studentName: string;
  }): Promise<void> {
    const tokenRecord = await prisma.authToken.findUnique({
      where: { id: payload.authTokenId },
    });
    if (!tokenRecord || !tokenRecord.encryptedToken) return;
    const rawOtp = decryptDeliverySecret(tokenRecord.encryptedToken);
    if (!rawOtp) return;
    await emailService.sendEmailVerificationOtp(payload.email, rawOtp, payload.studentName);
  }

  private async executeDirectAdminOtpFallback(payload: {
    email: string;
    authTokenId: string;
    adminName: string;
  }): Promise<void> {
    const tokenRecord = await prisma.authToken.findUnique({
      where: { id: payload.authTokenId },
    });
    if (!tokenRecord || !tokenRecord.encryptedToken) return;
    const rawOtp = decryptDeliverySecret(tokenRecord.encryptedToken);
    if (!rawOtp) return;
    await emailService.sendAdminLoginOtp(payload.email, rawOtp, payload.adminName);
  }

  private async executeDirectPasswordResetFallback(payload: {
    email: string;
    authTokenId: string;
    userName: string;
  }): Promise<void> {
    const tokenRecord = await prisma.authToken.findUnique({
      where: { id: payload.authTokenId },
    });
    if (!tokenRecord || !tokenRecord.encryptedToken) return;
    const rawToken = decryptDeliverySecret(tokenRecord.encryptedToken);
    if (!rawToken) return;
    const resetLink = `https://codek.local/reset-password?token=${rawToken}`;
    await emailService.sendMail({
      to: payload.email,
      subject: 'Reset Your CodeK Academy Password',
      text: `Hello ${payload.userName},\n\nPlease reset your password using the following link:\n${resetLink}\n\nCodeK Academy Team`,
    });
  }
}

export const emailQueue = new EmailQueue();
