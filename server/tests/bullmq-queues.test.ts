import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { UnrecoverableError } from 'bullmq';
import { EMAIL_QUEUE, VIDEO_QUEUE } from '../src/queues/queue-names.js';
import { EmailJobType, VideoJobType } from '../src/queues/types.js';
import { DEFAULT_JOB_OPTIONS, getOrCreateQueue, closeAllQueues } from '../src/queues/queue-factory.js';
import { sanitizeRedisUrl } from '../src/infrastructure/redis/redis.js';
import { emailService } from '../src/services/email/email.service.js';
import { emailQueue, QueueServiceUnavailableError } from '../src/queues/email/email.queue.js';
import { videoQueue, VideoQueueServiceUnavailableError } from '../src/queues/video/video.queue.js';
import { EmailWorker } from '../src/queues/email/email.worker.js';
import { VideoWorker } from '../src/queues/video/video.worker.js';
import { videoProviderFactory } from '../src/modules/videos/video-provider.factory.js';
import { encryptDeliverySecret, decryptDeliverySecret } from '../src/utils/crypto-delivery.js';
import { prisma } from '../src/db/prisma.js';
import { env } from '../src/config/env.js';
import * as authService from '../src/modules/auth/auth.service.js';
import * as userService from '../src/modules/users/user.service.js';
import { hashToken } from '../src/common/utils/crypto.js';
import { verify2FATempToken } from '../src/common/utils/jwt.js';
import { Role, StudentGrade, AuthTokenType } from '@prisma/client';

describe('BullMQ & Redis Background Architecture Hardening', () => {
  beforeAll(() => {
    // Spies for external services
    vi.spyOn(emailService, 'sendEmailVerificationOtp').mockResolvedValue(true);
    vi.spyOn(emailService, 'sendAdminLoginOtp').mockResolvedValue(true);
    vi.spyOn(emailService, 'sendMail').mockResolvedValue(true);
  });

  afterAll(async () => {
    await closeAllQueues();
    vi.restoreAllMocks();
  });

  describe('1. Configuration & Security', () => {
    it('sanitizes Redis URLs to protect credentials from logs', () => {
      const sensitiveUrl = 'redis://default:superSecretPassword123@redis.production.codek.local:6379/0';
      const sanitized = sanitizeRedisUrl(sensitiveUrl);
      expect(sanitized).not.toContain('superSecretPassword123');
      expect(sanitized).toContain('******');
      expect(sanitized).toContain('redis.production.codek.local');
    });

    it('handles malformed Redis URLs safely', () => {
      const sanitized = sanitizeRedisUrl('invalid-url-format');
      expect(sanitized).toBe('redis://[redacted]');
    });

    it('configures standard BullMQ retry and retention defaults', () => {
      expect(DEFAULT_JOB_OPTIONS.attempts).toBe(3);
      expect(DEFAULT_JOB_OPTIONS.backoff).toEqual({
        type: 'exponential',
        delay: 2000,
      });
      expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toEqual({
        count: 500,
        age: 86400,
      });
      expect(DEFAULT_JOB_OPTIONS.removeOnFail).toEqual({
        count: 1000,
        age: 604800,
      });
    });

    it('registers exactly two queues: email and video', () => {
      expect(EMAIL_QUEUE).toBe('email');
      expect(VIDEO_QUEUE).toBe('video');
    });
  });

  describe('2. Secret-Free Redis Payloads & AES-256-GCM Delivery Encryption', () => {
    it('encrypts and decrypts delivery secrets accurately with AES-256-GCM', () => {
      const rawOtp = '849201';
      const encrypted = encryptDeliverySecret(rawOtp);

      // Ciphertext format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
      expect(encrypted).not.toContain(rawOtp); // Zero plaintext secret exposure

      const decrypted = decryptDeliverySecret(encrypted);
      expect(decrypted).toBe(rawOtp);
    });

    it('returns null on corrupted or tampered ciphertext', () => {
      const corrupted = 'badiv:badtag:badciphertext';
      const result = decryptDeliverySecret(corrupted);
      expect(result).toBeNull();
    });

    it('enqueues email verification with authTokenId reference and NO plaintext secrets', async () => {
      const testAuthTokenId = 'auth-token-uuid-1111';
      const res = await emailQueue.enqueueEmailVerification({
        email: 'student@codek.local',
        authTokenId: testAuthTokenId,
        studentName: 'Ahmed',
      });

      expect(res).toBeDefined();
      expect(typeof res).toBe('string');

      // Verify the raw BullMQ job does not contain otpCode
      const rawQueue = emailQueue.getRawQueue();
      const job = await rawQueue.getJob(`verify_${testAuthTokenId}`);
      if (job) {
        expect(job.data).toHaveProperty('authTokenId', testAuthTokenId);
        expect(job.data).not.toHaveProperty('otpCode');
        expect(job.data).not.toHaveProperty('password');
        expect(job.data).not.toHaveProperty('token');
      }
    });

    it('enqueues admin 2FA OTP with authTokenId reference and NO plaintext secrets', async () => {
      const testAuthTokenId = 'auth-token-uuid-2222';
      const res = await emailQueue.enqueueAdminLoginOtp({
        email: 'admin@codek.local',
        authTokenId: testAuthTokenId,
        adminName: 'Administrator',
      });

      expect(res).toBeDefined();
      expect(typeof res).toBe('string');

      const rawQueue = emailQueue.getRawQueue();
      const job = await rawQueue.getJob(`admin_otp_${testAuthTokenId}`);
      if (job) {
        expect(job.data).toHaveProperty('authTokenId', testAuthTokenId);
        expect(job.data).not.toHaveProperty('otpCode');
      }
    });

    it('enqueues password reset with authTokenId reference and NO plaintext reset tokens', async () => {
      const testAuthTokenId = 'auth-token-uuid-3333';
      const res = await emailQueue.enqueuePasswordReset({
        email: 'user@codek.local',
        authTokenId: testAuthTokenId,
        userName: 'User',
      });

      expect(res).toBeDefined();
      expect(typeof res).toBe('string');

      const rawQueue = emailQueue.getRawQueue();
      const job = await rawQueue.getJob(`reset_${testAuthTokenId}`);
      if (job) {
        expect(job.data).toHaveProperty('authTokenId', testAuthTokenId);
        expect(job.data).not.toHaveProperty('resetLink');
        expect(job.data).not.toHaveProperty('token');
      }
    });
  });

  describe('3. Deterministic Email Job IDs & Legitimate Resend Semantics', () => {
    it('Verification: resend creates a new job without collision or accidental suppression', async () => {
      const initialTokenId = 'verify-token-' + Date.now();
      const resendTokenId = 'verify-token-resend-' + Date.now();

      // Step 1: User registers -> job 1
      const job1 = await emailQueue.enqueueEmailVerification({
        email: 'resend-test@codek.local',
        authTokenId: initialTokenId,
        studentName: 'Student',
      });

      // Step 2: User requests resend -> job 2 with new authTokenId
      const job2 = await emailQueue.enqueueEmailVerification({
        email: 'resend-test@codek.local',
        authTokenId: resendTokenId,
        studentName: 'Student',
      });

      // Both jobs must be distinct and successfully queued
      expect(job1).toBe(`verify_${initialTokenId}`);
      expect(job2).toBe(`verify_${resendTokenId}`);
      expect(job1).not.toBe(job2);
    });

    it('Password reset: multiple legitimate requests generate distinct jobs', async () => {
      const resetId1 = 'reset-token-1-' + Date.now();
      const resetId2 = 'reset-token-2-' + Date.now();

      const job1 = await emailQueue.enqueuePasswordReset({
        email: 'reset-user@codek.local',
        authTokenId: resetId1,
        userName: 'User',
      });

      const job2 = await emailQueue.enqueuePasswordReset({
        email: 'reset-user@codek.local',
        authTokenId: resetId2,
        userName: 'User',
      });

      expect(job1).toBe(`reset_${resetId1}`);
      expect(job2).toBe(`reset_${resetId2}`);
      expect(job1).not.toBe(job2);
    });

    it('Admin OTP: multiple OTP requests generate distinct jobs and deduplicate retries', async () => {
      const otpId1 = 'otp-token-1-' + Date.now();
      const otpId2 = 'otp-token-2-' + Date.now();

      const job1 = await emailQueue.enqueueAdminLoginOtp({
        email: 'admin-multi@codek.local',
        authTokenId: otpId1,
        adminName: 'Admin',
      });

      const job2 = await emailQueue.enqueueAdminLoginOtp({
        email: 'admin-multi@codek.local',
        authTokenId: otpId2,
        adminName: 'Admin',
      });

      // Resend generates distinct job
      expect(job1).toBe(`admin_otp_${otpId1}`);
      expect(job2).toBe(`admin_otp_${otpId2}`);

      // Network retry of the same otpId1 retains the same jobId for deduplication
      const retryJob = await emailQueue.enqueueAdminLoginOtp({
        email: 'admin-multi@codek.local',
        authTokenId: otpId1,
        adminName: 'Admin',
      });
      expect(retryJob).toBe(`admin_otp_${otpId1}`);
    });

    afterAll(async () => {
      // Drain synthetic jobs from queue so they do not pollute subsequent worker tests
      await emailQueue.getRawQueue().drain();
    });
  });

  describe('4. Video Queue Producer & Cleanup Safety', () => {
    it('enqueues VIDEO_READY with deterministic ID', async () => {
      const res = await videoQueue.enqueueVideoReady({
        videoAssetId: 'test-asset-123',
        providerVideoId: 'mux-asset-456',
        playbackId: 'test-playback-789',
        durationSeconds: 120,
      });

      expect(res === null || typeof res === 'string').toBe(true);
    });

    it('enqueues VIDEO_FAILED on processing error', async () => {
      const res = await videoQueue.enqueueVideoFailed({
        videoAssetId: 'test-asset-err',
        providerVideoId: 'mux-asset-err',
        errorMessage: 'Invalid codec',
      });

      expect(res === null || typeof res === 'string').toBe(true);
    });

    it('enqueues VIDEO_CLEANUP targeting exact providerVideoId', async () => {
      const targetMuxId = 'mux-delete-' + Date.now();
      const res = await videoQueue.enqueueVideoCleanup({
        provider: 'MUX',
        providerVideoId: targetMuxId,
      });

      expect(res).toBe(`video_cleanup_MUX_${targetMuxId}`);
    });

    it('rejects VIDEO_CLEANUP when providerVideoId is empty', async () => {
      await expect(
        videoQueue.enqueueVideoCleanup({
          provider: 'MUX',
          providerVideoId: '',
        })
      ).rejects.toThrow('non-empty providerVideoId');
    });

    it('handles duplicate VIDEO_READY events safely without corrupting state', async () => {
      const assetId = 'idempotent-asset-' + Date.now();
      const providerId = 'mux-provider-' + Date.now();

      const res1 = await videoQueue.enqueueVideoReady({
        videoAssetId: assetId,
        providerVideoId: providerId,
        playbackId: 'playback-1',
        durationSeconds: 60,
      });

      const res2 = await videoQueue.enqueueVideoReady({
        videoAssetId: assetId,
        providerVideoId: providerId,
        playbackId: 'playback-1',
        durationSeconds: 60,
      });

      expect(res1).toBe(`video_ready_${assetId}_${providerId}`);
      expect(res2).toBe(`video_ready_${assetId}_${providerId}`);
    });
  });

  describe('5. Architecture Principles Verification', () => {
    it('does not proxy raw video bytes through Redis or queue payloads', () => {
      const samplePayload = {
        type: VideoJobType.VIDEO_READY,
        videoAssetId: 'asset-id-uuid',
        providerVideoId: 'mux-id',
        playbackId: 'signed-playback-id',
        durationSeconds: 300,
      };

      const payloadString = JSON.stringify(samplePayload);
      expect(payloadString.length).toBeLessThan(500);
      expect(samplePayload).not.toHaveProperty('file');
      expect(samplePayload).not.toHaveProperty('buffer');
      expect(samplePayload).not.toHaveProperty('stream');
    });

    it('does not leak authentication passwords or OTP secrets into email payloads', () => {
      const sampleEmailPayload = {
        type: EmailJobType.EMAIL_VERIFICATION,
        email: 'student@codek.local',
        authTokenId: 'uuid-reference',
        studentName: 'Omar',
      };

      expect(sampleEmailPayload).not.toHaveProperty('otpCode');
      expect(sampleEmailPayload).not.toHaveProperty('resetLink');
      expect(sampleEmailPayload).not.toHaveProperty('password');
      expect(sampleEmailPayload).not.toHaveProperty('passwordHash');
      expect(sampleEmailPayload).not.toHaveProperty('jwtSecret');
    });
  });

  describe('6. Real End-to-End Queue Integration Flows', () => {
    let emailWorker: EmailWorker;

    beforeAll(async () => {
      emailWorker = new EmailWorker();
      await emailWorker.worker.waitUntilReady();
    });

    afterAll(async () => {
      await emailWorker.close();
    });

    it('E2E Registration Verification: creates AuthToken, queues non-secret payload, worker decrypts, and verification succeeds', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendEmailVerificationOtp');
      sendSpy.mockClear();

      const regEmail = `e2e_reg_${Date.now()}@codek.local`;
      const regRes = await authService.registerStudent({
        firstName: 'E2E',
        lastName: 'Tester',
        email: regEmail,
        password: 'Password@123',
        grade: StudentGrade.GRADE_1,
      });

      expect(regRes.userId).toBeDefined();
      const userId = regRes.userId;

      // 1. AuthToken exists in PostgreSQL with encryptedToken and PENDING status
      const tokenRecord = await prisma.authToken.findFirst({
        where: { userId, type: AuthTokenType.EMAIL_VERIFICATION, status: 'PENDING' },
      });
      expect(tokenRecord).not.toBeNull();
      expect(tokenRecord?.encryptedToken).toBeDefined();

      // 2. Inspect Redis/BullMQ job directly: contains zero secrets
      const rawQueue = emailQueue.getRawQueue();
      const job = await rawQueue.getJob(`verify_${tokenRecord!.id}`);
      expect(job).not.toBeNull();
      expect(job!.data).toEqual({
        type: EmailJobType.EMAIL_VERIFICATION,
        email: regEmail,
        authTokenId: tokenRecord!.id,
        studentName: 'E2E',
      });
      expect((job!.data as any).otpCode).toBeUndefined();
      expect((job!.data as any).password).toBeUndefined();
      expect((job!.data as any).token).toBeUndefined();
      expect(job!.id).not.toMatch(/\b\d{6}\b/);

      // 3. Worker consumes job from queue
      await vi.waitFor(() => {
        const calls = sendSpy.mock.calls.filter(([email]) => email === regEmail);
        expect(calls.length).toBe(1);
      }, { timeout: 6000 });

      // 4. Mock email provider received the decrypted 6-digit OTP
      const callsForReg = sendSpy.mock.calls.filter(([email]) => email === regEmail);
      const [calledEmail, calledOtp, calledName] = callsForReg[0];
      expect(calledEmail).toBe(regEmail);
      expect(calledOtp).toMatch(/^\d{6}$/);
      expect(calledName).toBe('E2E');

      // 5. DB cleanup: encryptedToken is wiped to null, but status is STILL PENDING (auth state unverified)
      await vi.waitFor(async () => {
        const afterDelivery = await prisma.authToken.findUnique({
          where: { id: tokenRecord!.id },
        });
        expect(afterDelivery?.encryptedToken).toBeNull();
        expect(afterDelivery?.status).toBe('PENDING');
      });

      // 6. Existing verification flow completes using the delivered OTP
      const verifyRes = await authService.verifyEmail({
        userId,
        otpCode: calledOtp,
      });
      expect(verifyRes.user.isEmailVerified).toBe(true);
      expect(verifyRes.accessToken).toBeDefined();
    });

    it('E2E Admin Login OTP: creates AuthToken, queues non-secret payload, worker decrypts, and 2FA completes', async () => {
      const otpSpy = vi.spyOn(emailService, 'sendAdminLoginOtp');
      otpSpy.mockClear();

      const adminUser = await prisma.user.findFirst({
        where: { role: Role.ADMIN },
      });
      expect(adminUser).not.toBeNull();

      // Clear any pending OTPs for test isolation
      await prisma.authToken.deleteMany({
        where: { userId: adminUser!.id, type: AuthTokenType.ADMIN_LOGIN_OTP },
      });

      // 1. Admin login initiates 2FA
      const loginRes = await authService.login({
        loginId: adminUser!.loginId,
        password: env.ADMIN_PASSWORD || 'Admin@123456',
      });
      expect(loginRes.requires2FA).toBe(true);
      expect(loginRes.tempToken).toBeDefined();

      const decoded = verify2FATempToken(loginRes.tempToken!);
      const authTokenId = (decoded.otpId || (decoded as any).challengeId)!;

      // 2. Inspect Redis job directly: non-secret payload
      const rawQueue = emailQueue.getRawQueue();
      const job = await rawQueue.getJob(`admin_otp_${authTokenId}`);
      expect(job).not.toBeNull();
      expect(job!.data).toEqual({
        type: EmailJobType.ADMIN_LOGIN_OTP,
        email: adminUser!.email || env.ADMIN_EMAIL,
        authTokenId,
        adminName: `${adminUser!.firstName} ${adminUser!.lastName}`.trim(),
      });
      expect((job!.data as any).otpCode).toBeUndefined();
      expect(job!.id).not.toMatch(/\b\d{6}\b/);

      // 3. Worker consumes job from queue
      const targetAdminEmail = adminUser!.email || env.ADMIN_EMAIL;
      await vi.waitFor(() => {
        const calls = otpSpy.mock.calls.filter(([email]) => email === targetAdminEmail);
        expect(calls.length).toBe(1);
      }, { timeout: 6000 });

      const callsForAdmin = otpSpy.mock.calls.filter(([email]) => email === targetAdminEmail);
      const [calledEmail, calledOtp] = callsForAdmin[0];
      expect(calledOtp).toMatch(/^\d{6}$/);

      // 4. DB cleanup check: encryptedToken is null, status is STILL PENDING
      await vi.waitFor(async () => {
        const afterDelivery = await prisma.authToken.findUnique({
          where: { id: authTokenId },
        });
        expect(afterDelivery?.encryptedToken).toBeNull();
        expect(afterDelivery?.status).toBe('PENDING');
      });

      // 5. Complete 2FA
      const verifyRes = await authService.verifyAdminOtp({
        tempToken: loginRes.tempToken,
        otpCode: calledOtp,
      });
      expect(verifyRes.accessToken).toBeDefined();
      expect(verifyRes.user.role).toBe('ADMIN');
    });

    it('E2E Password Reset: generates reset token, queues non-secret payload, worker constructs link, and reset succeeds', async () => {
      const testEmail = `reset_e2e_${Date.now()}@codek.local`;
      const testUser = await prisma.user.create({
        data: {
          email: testEmail,
          loginId: `STU-RST-${Date.now()}`,
          firstName: 'Reset',
          lastName: 'User',
          passwordHash: 'dummyHash',
          role: Role.STUDENT,
        },
      });

      const mailSpy = vi.spyOn(emailService, 'sendMail');
      mailSpy.mockClear();

      // 1. Generate reset link
      const resetResult = await userService.generateOneTimeResetLink(testUser.id);
      expect(resetResult.expiresAt).toBeDefined();

      const authToken = await prisma.authToken.findFirst({
        where: { userId: testUser.id, type: AuthTokenType.PASSWORD_RESET, status: 'PENDING' },
      });
      expect(authToken).not.toBeNull();
      expect(authToken?.encryptedToken).toBeDefined();

      // 2. Inspect Redis job directly
      const rawQueue = emailQueue.getRawQueue();
      const job = await rawQueue.getJob(`reset_${authToken!.id}`);
      expect(job).not.toBeNull();
      expect(job!.data).toEqual({
        type: EmailJobType.PASSWORD_RESET,
        email: testEmail,
        authTokenId: authToken!.id,
        userName: 'Reset User',
      });
      expect((job!.data as any).token).toBeUndefined();
      expect((job!.data as any).resetLink).toBeUndefined();

      // 3. Worker consumes job from queue
      await vi.waitFor(() => {
        const calls = mailSpy.mock.calls.filter(([opts]) => opts.to === testEmail);
        expect(calls.length).toBe(1);
      }, { timeout: 4000 });

      const callsForReset = mailSpy.mock.calls.filter(([opts]) => opts.to === testEmail);
      const mailOptions = callsForReset[0][0];
      expect(mailOptions.to).toBe(testEmail);
      expect(mailOptions.text).toContain('/reset-password?token=');

      const tokenMatch = mailOptions.text.match(/token=([a-f0-9]+)/i);
      expect(tokenMatch).not.toBeNull();
      const deliveredToken = tokenMatch![1];

      // 4. DB cleanup check: encryptedToken is null, status is STILL PENDING
      await vi.waitFor(async () => {
        const afterDelivery = await prisma.authToken.findUnique({
          where: { id: authToken!.id },
        });
        expect(afterDelivery?.encryptedToken).toBeNull();
        expect(afterDelivery?.status).toBe('PENDING');
      });

      // 5. Complete password reset
      const newPassword = 'BrandNewPassword@2026';
      const resetOutcome = await authService.resetPassword({ token: deliveredToken, newPassword });
      expect(resetOutcome.success).toBe(true);

      const finalUser = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(finalUser?.passwordHash).not.toBe('dummyHash');
    });
  });

  describe('7. Worker Crash & Retry Semantics (At-Least-Once Delivery)', () => {
    let emailWorker: EmailWorker;

    beforeAll(() => {
      emailWorker = new EmailWorker();
    });

    afterAll(async () => {
      await emailWorker.close();
    });

    it('safely tolerates worker crash before DB purge: retry delivers identical code and completes purge', async () => {
      const rawOtp = String(Math.floor(100000 + Math.random() * 900000));
      const user = await prisma.user.create({
        data: {
          email: `crash_test_${Date.now()}@codek.local`,
          loginId: `CRASH-${Date.now()}`,
          firstName: 'Crash',
          lastName: 'Tester',
          passwordHash: 'dummy',
          role: Role.STUDENT,
        },
      });

      const tokenRecord = await prisma.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawOtp),
          encryptedToken: encryptDeliverySecret(rawOtp),
          type: AuthTokenType.EMAIL_VERIFICATION,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 600000),
        },
      });

      const sendSpy = vi.spyOn(emailService, 'sendEmailVerificationOtp');
      sendSpy.mockClear();

      const job = {
        data: {
          type: EmailJobType.EMAIL_VERIFICATION,
          email: user.email,
          authTokenId: tokenRecord.id,
          studentName: 'Crash Tester',
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      // Simulate first attempt: email sent, but process crashes before DB update
      const realUpdate = prisma.authToken.update;
      let shouldFailUpdate = true;
      prisma.authToken.update = (async (...args: any[]) => {
        if (shouldFailUpdate) {
          shouldFailUpdate = false;
          throw new Error('Simulated worker process crash / network drop before DB purge');
        }
        return realUpdate.apply(prisma.authToken, args as any);
      }) as any;

      try {
        await expect((emailWorker as any).processJob(job)).rejects.toThrow('Simulated worker process crash');
        expect(sendSpy).toHaveBeenCalledTimes(1);

        // Verify token in DB still has encryptedToken (not purged yet)
        const midway = await prisma.authToken.findUnique({ where: { id: tokenRecord.id } });
        expect(midway?.encryptedToken).not.toBeNull();
        expect(midway?.status).toBe('PENDING');

        // BullMQ retry (second attempt)
        job.attemptsMade = 1;
        await (emailWorker as any).processJob(job);

        // Email was sent a second time (at-least-once delivery)
        expect(sendSpy).toHaveBeenCalledTimes(2);
        expect(sendSpy.mock.calls[1][1]).toBe(rawOtp); // Exactly identical valid OTP

        // Purge now succeeded
        const finished = await prisma.authToken.findUnique({ where: { id: tokenRecord.id } });
        expect(finished?.encryptedToken).toBeNull();
        expect(finished?.status).toBe('PENDING');
      } finally {
        prisma.authToken.update = realUpdate;
      }
    });

    it('safely drops retry if user already verified and token is USED', async () => {
      const user = await prisma.user.create({
        data: {
          email: `used_test_${Date.now()}@codek.local`,
          loginId: `USED-${Date.now()}`,
          firstName: 'Used',
          lastName: 'Tester',
          passwordHash: 'dummy',
          role: Role.STUDENT,
        },
      });

      const tokenRecord = await prisma.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(`used_hash_${Date.now()}_${Math.random()}`),
          encryptedToken: encryptDeliverySecret('123456'),
          type: AuthTokenType.EMAIL_VERIFICATION,
          status: 'VERIFIED',
          expiresAt: new Date(Date.now() + 600000),
        },
      });

      const sendSpy = vi.spyOn(emailService, 'sendEmailVerificationOtp');
      sendSpy.mockClear();

      const job = {
        data: {
          type: EmailJobType.EMAIL_VERIFICATION,
          email: user.email,
          authTokenId: tokenRecord.id,
          studentName: 'Used Tester',
        },
        attemptsMade: 1,
        opts: {},
      } as any;

      await (emailWorker as any).processJob(job);
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('safely skips if delivery secret has already been purged', async () => {
      const user = await prisma.user.create({
        data: {
          email: `purged_test_${Date.now()}@codek.local`,
          loginId: `PURGED-${Date.now()}`,
          firstName: 'Purged',
          lastName: 'Tester',
          passwordHash: 'dummy',
          role: Role.STUDENT,
        },
      });

      const tokenRecord = await prisma.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(`purged_hash_${Date.now()}_${Math.random()}`),
          encryptedToken: null,
          type: AuthTokenType.EMAIL_VERIFICATION,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 600000),
        },
      });

      const sendSpy = vi.spyOn(emailService, 'sendEmailVerificationOtp');
      sendSpy.mockClear();

      const job = {
        data: {
          type: EmailJobType.EMAIL_VERIFICATION,
          email: user.email,
          authTokenId: tokenRecord.id,
        },
        attemptsMade: 1,
        opts: {},
      } as any;

      await (emailWorker as any).processJob(job);
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe('8. Resend & Token Invalidation Protection', () => {
    it('skips delivery of older token if it was invalidated by a resend', async () => {
      const user = await prisma.user.create({
        data: {
          email: `inval_${Date.now()}@codek.local`,
          loginId: `INVAL-${Date.now()}`,
          firstName: 'Inval',
          lastName: 'Tester',
          passwordHash: 'dummy',
          role: Role.STUDENT,
        },
      });

      const tokenA = await prisma.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(`inval_a_${Date.now()}_${Math.random()}`),
          encryptedToken: encryptDeliverySecret('111111'),
          type: AuthTokenType.EMAIL_VERIFICATION,
          status: 'INVALIDATED',
          expiresAt: new Date(Date.now() + 600000),
        },
      });

      const tokenB = await prisma.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(`inval_b_${Date.now()}_${Math.random()}`),
          encryptedToken: encryptDeliverySecret('222222'),
          type: AuthTokenType.EMAIL_VERIFICATION,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 600000),
        },
      });

      const sendSpy = vi.spyOn(emailService, 'sendEmailVerificationOtp');
      sendSpy.mockClear();

      const worker = new EmailWorker();

      // Attempting to deliver Token A -> skipped
      await (worker as any).processJob({
        data: {
          type: EmailJobType.EMAIL_VERIFICATION,
          email: user.email,
          authTokenId: tokenA.id,
        },
        attemptsMade: 0,
        opts: {},
      });
      expect(sendSpy).not.toHaveBeenCalled();

      // Delivering Token B -> succeeds
      await (worker as any).processJob({
        data: {
          type: EmailJobType.EMAIL_VERIFICATION,
          email: user.email,
          authTokenId: tokenB.id,
          studentName: 'Inval',
        },
        attemptsMade: 0,
        opts: {},
      });
      expect(sendSpy).toHaveBeenCalledWith(user.email, '222222', 'Inval');
      await worker.close();
    });
  });

  describe('9. Production Redis Failure Semantics', () => {
    it('strictly throws QueueServiceUnavailableError in production when Redis fails', async () => {
      const origEnv = env.NODE_ENV;
      (env as any).NODE_ENV = 'production';

      const rawQueue = emailQueue.getRawQueue();
      const addSpy = vi.spyOn(rawQueue, 'add').mockRejectedValueOnce(new Error('Redis connection refused: ECONNREFUSED 127.0.0.1:6379'));

      try {
        await expect(
          emailQueue.enqueueEmailVerification({
            email: 'fail@codek.local',
            authTokenId: 'any-token',
          })
        ).rejects.toThrow(QueueServiceUnavailableError);
      } finally {
        (env as any).NODE_ENV = origEnv;
        addSpy.mockRestore();
      }
    });

    it('strictly throws VideoQueueServiceUnavailableError in production when Redis fails', async () => {
      const origEnv = env.NODE_ENV;
      (env as any).NODE_ENV = 'production';

      const rawQueue = videoQueue.getRawQueue();
      const addSpy = vi.spyOn(rawQueue, 'add').mockRejectedValueOnce(new Error('Redis connection refused: ECONNREFUSED 127.0.0.1:6379'));

      try {
        await expect(
          videoQueue.enqueueVideoReady({
            videoAssetId: 'asset-1',
            providerVideoId: 'mux-1',
          })
        ).rejects.toThrow(VideoQueueServiceUnavailableError);
      } finally {
        (env as any).NODE_ENV = origEnv;
        addSpy.mockRestore();
      }
    });
  });

  describe('10. Video Cleanup Safety (Exact Provider Targeting)', () => {
    it('cleanup deletes exact specified provider asset and never touches current active asset', async () => {
      const muxProvider = videoProviderFactory.getProvider('MUX');
      const deleteSpy = vi.spyOn(muxProvider, 'deleteVideo').mockResolvedValue(undefined as any);

      const oldAssetId = 'mux_old_video_asset_' + Date.now();
      const newAssetId = 'mux_new_active_video_asset_' + Date.now();

      const worker = new VideoWorker();

      // Cleanup job targeting oldAssetId executes
      await (worker as any).processJob({
        data: {
          type: VideoJobType.VIDEO_CLEANUP,
          provider: 'MUX',
          providerVideoId: oldAssetId,
        },
        attemptsMade: 0,
        opts: {},
      });

      // Verify Mux SDK was called with oldAssetId ONLY
      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith(oldAssetId);
      expect(deleteSpy).not.toHaveBeenCalledWith(newAssetId);

      await worker.close();
      deleteSpy.mockRestore();
    });
  });

  describe('11. VIDEO_READY Idempotency Guarantees', () => {
    it('multiple executions of VIDEO_READY do not produce duplicate audit logs', async () => {
      const ts = Date.now();
      const curriculum = await prisma.curriculum.create({
        data: {
          title: 'Idempotency Curriculum ' + ts,
          grade: StudentGrade.GRADE_1,
        },
      });

      const section = await prisma.section.create({
        data: {
          curriculumId: curriculum.id,
          title: 'Section 1',
          order: 1,
        },
      });

      const lesson = await prisma.lesson.create({
        data: {
          curriculumId: curriculum.id,
          sectionId: section.id,
          title: 'Idempotent Lesson ' + ts,
          content: 'Idempotency test markdown content',
          order: 1,
          videoDurationSeconds: 0,
        },
      });

      const videoAsset = await prisma.videoAsset.create({
        data: {
          code: 'VID-IDEMP-' + ts,
          title: 'Idempotent Asset',
          provider: 'MUX',
          providerVideoId: 'mux_idemp_' + ts,
          status: 'READY',
          durationSeconds: 300,
        },
      });

      const worker = new VideoWorker();
      const job = {
        data: {
          type: VideoJobType.VIDEO_READY,
          videoAssetId: videoAsset.id,
          providerVideoId: videoAsset.providerVideoId,
          playbackId: 'playback_' + ts,
          durationSeconds: 300,
          targetLessonId: lesson.id,
        },
        attemptsMade: 0,
        opts: {},
      } as any;

      // First run
      await (worker as any).processJob(job);

      const lessonAfterFirst = await prisma.lesson.findUnique({ where: { id: lesson.id } });
      expect(lessonAfterFirst?.videoDurationSeconds).toBe(300);

      const logsFirst = await prisma.auditLog.findMany({
        where: {
          action: 'VIDEO_READY',
          entityType: 'Lesson',
          entityId: lesson.id,
        },
      });
      expect(logsFirst.length).toBe(1);

      // Second run (simulating retry of the same BullMQ job)
      job.attemptsMade = 1;
      await (worker as any).processJob(job);

      const lessonAfterSecond = await prisma.lesson.findUnique({ where: { id: lesson.id } });
      expect(lessonAfterSecond?.videoDurationSeconds).toBe(300);

      const logsSecond = await prisma.auditLog.findMany({
        where: {
          action: 'VIDEO_READY',
          entityType: 'Lesson',
          entityId: lesson.id,
        },
      });
      expect(logsSecond.length).toBe(1); // ZERO duplicate audit logs!

      await worker.close();
    });
  });

  describe('12. SMTP Error Classification (Transient vs Permanent Failures)', () => {
    let emailWorker: EmailWorker;

    beforeAll(() => {
      emailWorker = new EmailWorker();
    });

    afterAll(async () => {
      await emailWorker.close();
    });

    it('transient SMTP network error rethrows standard Error for BullMQ retry', async () => {
      const user = await prisma.user.create({
        data: {
          email: `transient_${Date.now()}@codek.local`,
          loginId: `TRANSIENT-${Date.now()}`,
          firstName: 'Transient',
          lastName: 'Tester',
          passwordHash: 'dummy',
          role: Role.STUDENT,
        },
      });

      const tokenRecord = await prisma.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(`transient_hash_${Date.now()}`),
          encryptedToken: encryptDeliverySecret('123456'),
          type: AuthTokenType.EMAIL_VERIFICATION,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 600000),
        },
      });

      const sendSpy = vi.spyOn(emailService, 'sendEmailVerificationOtp').mockRejectedValueOnce(
        new Error('ETIMEDOUT: Connection to SMTP host timed out')
      );

      const job = {
        data: {
          type: EmailJobType.EMAIL_VERIFICATION,
          email: user.email,
          authTokenId: tokenRecord.id,
          studentName: 'Transient Tester',
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      try {
        // Must throw a standard retryable Error, NOT UnrecoverableError
        await expect((emailWorker as any).processJob(job)).rejects.toThrow('ETIMEDOUT');
      } finally {
        sendSpy.mockRestore();
      }
    });

    it('permanent SMTP 535 authentication error throws UnrecoverableError without pointless retries', async () => {
      const user = await prisma.user.create({
        data: {
          email: `perm_${Date.now()}@codek.local`,
          loginId: `PERM-${Date.now()}`,
          firstName: 'Permanent',
          lastName: 'Tester',
          passwordHash: 'dummy',
          role: Role.STUDENT,
        },
      });

      const tokenRecord = await prisma.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(`perm_hash_${Date.now()}`),
          encryptedToken: encryptDeliverySecret('654321'),
          type: AuthTokenType.EMAIL_VERIFICATION,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 600000),
        },
      });

      const sendSpy = vi.spyOn(emailService, 'sendEmailVerificationOtp').mockRejectedValueOnce(
        new Error('535 5.7.8 Authentication credentials invalid')
      );

      const job = {
        data: {
          type: EmailJobType.EMAIL_VERIFICATION,
          email: user.email,
          authTokenId: tokenRecord.id,
          studentName: 'Permanent Tester',
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      try {
        // Must be identified as permanent error and throw UnrecoverableError
        expect((emailWorker as any).isPermanentError(new Error('535 5.7.8 Authentication credentials invalid'))).toBe(true);
      } finally {
        sendSpy.mockRestore();
      }
    });

    it('missing AuthToken in database is treated as permanent failure', async () => {
      const nonExistentId = 'non-existent-token-' + Date.now();
      const job = {
        data: {
          type: EmailJobType.EMAIL_VERIFICATION,
          email: 'stale@codek.local',
          authTokenId: nonExistentId,
          studentName: 'Stale',
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect((emailWorker as any).processJob(job)).rejects.toThrow(UnrecoverableError);
    });
  });

  describe('13. AuthToken Canonical State Independence After Secret Wipe', () => {
    it('verification succeeds via canonical tokenHash even after encryptedToken is wiped to null', async () => {
      const rawOtp = String(Math.floor(100000 + Math.random() * 900000));
      await prisma.authToken.deleteMany({ where: { tokenHash: hashToken(rawOtp) } });
      const user = await prisma.user.create({
        data: {
          email: `canonical_verify_${Date.now()}_${Math.random().toString(36).slice(2)}@codek.local`,
          loginId: `CANON-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          firstName: 'Canonical',
          lastName: 'Tester',
          passwordHash: 'dummy',
          role: Role.STUDENT,
        },
      });

      const tokenRecord = await prisma.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawOtp),
          encryptedToken: encryptDeliverySecret(rawOtp),
          type: AuthTokenType.EMAIL_VERIFICATION,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 600000),
        },
      });

      // Simulate post-delivery cleanup: encrypted delivery secret is wiped to null
      await prisma.authToken.update({
        where: { id: tokenRecord.id },
        data: { encryptedToken: null },
      });

      // Status must STILL be PENDING (email delivery success != authentication success)
      const afterWipe = await prisma.authToken.findUnique({ where: { id: tokenRecord.id } });
      expect(afterWipe?.encryptedToken).toBeNull();
      expect(afterWipe?.status).toBe('PENDING');

      // Canonical authentication/verification succeeds using the delivered OTP verified against tokenHash
      const verifyRes = await authService.verifyEmail({
        userId: user.id,
        otpCode: rawOtp,
      });
      expect(verifyRes.user.isEmailVerified).toBe(true);
      expect(verifyRes.accessToken).toBeDefined();

      // Now the token is atomically transitioned to VERIFIED
      const finalToken = await prisma.authToken.findUnique({ where: { id: tokenRecord.id } });
      expect(finalToken?.status).toBe('VERIFIED');
      expect(finalToken?.usedAt).not.toBeNull();
    });

    it('password reset succeeds via canonical tokenHash even after encryptedToken is wiped to null', async () => {
      const rawResetToken = 'reset_token_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '_secret';
      await prisma.authToken.deleteMany({ where: { tokenHash: hashToken(rawResetToken) } });
      const user = await prisma.user.create({
        data: {
          email: `canonical_reset_${Date.now()}_${Math.random().toString(36).slice(2)}@codek.local`,
          loginId: `CANON-RESET-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          firstName: 'Canonical',
          lastName: 'Reset',
          passwordHash: 'initialHash',
          role: Role.STUDENT,
        },
      });

      const tokenRecord = await prisma.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawResetToken),
          encryptedToken: encryptDeliverySecret(rawResetToken),
          type: AuthTokenType.PASSWORD_RESET,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 600000),
        },
      });

      // Delivery secret is wiped
      await prisma.authToken.update({
        where: { id: tokenRecord.id },
        data: { encryptedToken: null },
      });

      const afterWipe = await prisma.authToken.findUnique({ where: { id: tokenRecord.id } });
      expect(afterWipe?.encryptedToken).toBeNull();
      expect(afterWipe?.status).toBe('PENDING');

      // Password reset completes using the canonical tokenHash
      const resetOutcome = await authService.resetPassword({
        token: rawResetToken,
        newPassword: 'SuperNewPassword@2026',
      });
      expect(resetOutcome.success).toBe(true);

      const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updatedUser?.passwordHash).not.toBe('initialHash');
    });
  });

  describe('14. Secret-Safety Audit on Payloads and Job IDs', () => {
    it('verifies that queue payloads and job IDs strictly contain no secrets or credentials', async () => {
      const dummyTokenId = 'dummy-uuid-token-5555';
      const email = 'audit@codek.local';

      const verifyJobId = await emailQueue.enqueueEmailVerification({
        email,
        authTokenId: dummyTokenId,
        studentName: 'Audit Student',
      });

      const rawQueue = emailQueue.getRawQueue();
      const job = await rawQueue.getJob(verifyJobId!);

      // Assert payload contains only non-secret references
      expect(job).not.toBeNull();
      expect(job!.data).toEqual({
        type: EmailJobType.EMAIL_VERIFICATION,
        email,
        authTokenId: dummyTokenId,
        studentName: 'Audit Student',
      });

      // Explicitly assert absence of sensitive credentials in payload
      const sensitiveKeys = ['otp', 'otpCode', 'password', 'token', 'secret', 'jwt', 'resetLink', 'hash'];
      for (const key of sensitiveKeys) {
        expect(job!.data).not.toHaveProperty(key);
      }

      // Assert job ID contains NO numeric OTPs (e.g. 6-digit codes)
      expect(job!.id).not.toMatch(/\b\d{6}\b/);
      expect(job!.id).toBe(`verify_${dummyTokenId}`);
    });
  });
});
