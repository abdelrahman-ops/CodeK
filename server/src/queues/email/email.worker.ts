import { Worker, Job, UnrecoverableError } from 'bullmq';
import { EMAIL_QUEUE } from '../queue-names.js';
import { createRedisClient } from '../../infrastructure/redis/redis.js';
import { EmailJobData, EmailJobType } from '../types.js';
import { emailService } from '../../services/email/email.service.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { decryptDeliverySecret } from '../../utils/crypto-delivery.js';

export class EmailWorker {
  private worker: Worker<EmailJobData>;

  constructor() {
    const redisConnection = createRedisClient();

    this.worker = new Worker<EmailJobData>(
      EMAIL_QUEUE,
      async (job: Job<EmailJobData>) => {
        const startTime = Date.now();
        const { type } = job.data;

        // Structured start log (safe, zero secrets)
        const timeStr = new Date().toISOString().substring(11, 19);
        const refId = 'authTokenId' in job.data ? ` ref=${job.data.authTokenId}` : '';
        console.log(`[${timeStr} UTC] INFO  job ${EMAIL_QUEUE} ${type} started (attempt=${job.attemptsMade + 1}${refId})`);

        try {
          await this.processJob(job);
          const duration = Date.now() - startTime;
          console.log(`[${timeStr} UTC] INFO  job ${EMAIL_QUEUE} ${type} completed ${duration}ms`);
        } catch (error: any) {
          const isPermanent = this.isPermanentError(error);
          console.error(
            `[${timeStr} UTC] ERROR job ${EMAIL_QUEUE} ${type} failed (attempt=${job.attemptsMade + 1}/${job.opts.attempts || 3}):`,
            error.message
          );

          if (isPermanent) {
            // UnrecoverableError immediately fails the job in BullMQ without retry
            throw new UnrecoverableError(error.message);
          }

          throw error;
        }
      },
      {
        connection: redisConnection,
        concurrency: env.WORKER_CONCURRENCY_EMAIL || 5,
        prefix: env.NODE_ENV === 'test' ? 'bull:test' : (env.BULLMQ_PREFIX || 'bull'),
      }
    );

    this.worker.on('error', (err) => {
      console.error(`[EmailWorker] Worker error:`, err.message);
    });
  }

  private async processJob(job: Job<EmailJobData>): Promise<void> {
    const data = job.data;

    switch (data.type) {
      case EmailJobType.EMAIL_VERIFICATION: {
        if (!data.email || !data.authTokenId) {
          throw new UnrecoverableError('Invalid email verification payload: email and authTokenId are required');
        }

        // Fetch auth token record securely from PostgreSQL (Source of Truth)
        const tokenRecord = await prisma.authToken.findUnique({
          where: { id: data.authTokenId },
        });

        if (!tokenRecord) {
          throw new UnrecoverableError(`AuthToken ${data.authTokenId} not found in database (permanent failure)`);
        }

        // Explicit documented intentional stale no-op: user already verified or token superseded by resend
        if (tokenRecord.status !== 'PENDING') {
          console.log(`[EmailWorker] AuthToken ${data.authTokenId} status is ${tokenRecord.status} (already finalized), skipping delivery.`);
          return;
        }

        if (tokenRecord.expiresAt < new Date()) {
          throw new UnrecoverableError(`AuthToken ${data.authTokenId} has expired (permanent failure)`);
        }

        // Explicit documented intentional stale no-op: delivery secret was already wiped after previous delivery
        if (!tokenRecord.encryptedToken) {
          console.log(`[EmailWorker] AuthToken ${data.authTokenId} delivery secret already wiped, skipping.`);
          return;
        }

        const rawOtp = decryptDeliverySecret(tokenRecord.encryptedToken);
        if (!rawOtp) {
          throw new UnrecoverableError(`Corrupted delivery secret for authToken ${data.authTokenId}`);
        }

        await emailService.sendEmailVerificationOtp(
          data.email,
          rawOtp,
          data.studentName || 'Student'
        );

        // Defense in depth: wipe reversible delivery secret immediately upon successful transmission
        await prisma.authToken.update({
          where: { id: data.authTokenId },
          data: { encryptedToken: null },
        });

        break;
      }

      case EmailJobType.ADMIN_LOGIN_OTP: {
        if (!data.email || !data.authTokenId) {
          throw new UnrecoverableError('Invalid admin OTP payload: email and authTokenId are required');
        }

        const tokenRecord = await prisma.authToken.findUnique({
          where: { id: data.authTokenId },
        });

        if (!tokenRecord) {
          throw new UnrecoverableError(`AuthToken ${data.authTokenId} not found in database (permanent failure)`);
        }

        // Explicit documented intentional stale no-op: 2FA challenge already finalized or superseded
        if (tokenRecord.status !== 'PENDING') {
          console.log(`[EmailWorker] AuthToken ${data.authTokenId} status is ${tokenRecord.status} (already finalized), skipping delivery.`);
          return;
        }

        if (tokenRecord.expiresAt < new Date()) {
          throw new UnrecoverableError(`AuthToken ${data.authTokenId} has expired (permanent failure)`);
        }

        // Explicit documented intentional stale no-op: delivery secret already wiped
        if (!tokenRecord.encryptedToken) {
          console.log(`[EmailWorker] AuthToken ${data.authTokenId} delivery secret already wiped, skipping.`);
          return;
        }

        const rawOtp = decryptDeliverySecret(tokenRecord.encryptedToken);
        if (!rawOtp) {
          throw new UnrecoverableError(`Corrupted delivery secret for admin authToken ${data.authTokenId}`);
        }

        await emailService.sendAdminLoginOtp(
          data.email,
          rawOtp,
          data.adminName || 'Admin'
        );

        await prisma.authToken.update({
          where: { id: data.authTokenId },
          data: { encryptedToken: null },
        });

        break;
      }

      case EmailJobType.PASSWORD_RESET: {
        if (!data.email || !data.authTokenId) {
          throw new UnrecoverableError('Invalid password reset payload: email and authTokenId are required');
        }

        const tokenRecord = await prisma.authToken.findUnique({
          where: { id: data.authTokenId },
        });

        if (!tokenRecord) {
          throw new UnrecoverableError(`AuthToken ${data.authTokenId} not found in database (permanent failure)`);
        }

        // Explicit documented intentional stale no-op: password reset already finalized or superseded
        if (tokenRecord.status !== 'PENDING') {
          console.log(`[EmailWorker] AuthToken ${data.authTokenId} status is ${tokenRecord.status} (already finalized), skipping delivery.`);
          return;
        }

        if (tokenRecord.expiresAt < new Date()) {
          throw new UnrecoverableError(`AuthToken ${data.authTokenId} has expired (permanent failure)`);
        }

        // Explicit documented intentional stale no-op: delivery secret already wiped
        if (!tokenRecord.encryptedToken) {
          console.log(`[EmailWorker] AuthToken ${data.authTokenId} delivery secret already wiped, skipping.`);
          return;
        }

        const rawToken = decryptDeliverySecret(tokenRecord.encryptedToken);
        if (!rawToken) {
          throw new UnrecoverableError(`Corrupted delivery secret for password reset authToken ${data.authTokenId}`);
        }

        const resetLink = `https://codek.local/reset-password?token=${rawToken}`;
        await emailService.sendMail({
          to: data.email,
          subject: 'Reset Your CodeK Academy Password',
          text: `Hello ${data.userName || 'Student'},\n\nPlease reset your password using the following link:\n${resetLink}\n\nCodeK Academy Team`,
        });

        await prisma.authToken.update({
          where: { id: data.authTokenId },
          data: { encryptedToken: null },
        });

        break;
      }

      case EmailJobType.CUSTOM_MAIL: {
        if (!data.to || !data.subject) {
          throw new UnrecoverableError('Invalid custom email payload: to and subject are required');
        }
        await emailService.sendMail({
          to: data.to,
          subject: data.subject,
          text: data.text,
          html: data.html,
        });
        break;
      }

      default: {
        throw new UnrecoverableError(`Unknown email job type: ${(data as any).type}`);
      }
    }
  }

  private isPermanentError(error: any): boolean {
    if (error instanceof UnrecoverableError || error?.name === 'UnrecoverableError') {
      return true;
    }
    const msg = String(error?.message || '');
    const code = String(error?.code || error?.responseCode || '');

    // SMTP authentication permanent failure (535, EAUTH, invalid login)
    if (
      code === '535' ||
      code === 'EAUTH' ||
      msg.includes('535') ||
      msg.toLowerCase().includes('authentication failed') ||
      msg.toLowerCase().includes('invalid login')
    ) {
      return true;
    }

    // Invalid recipient / mailbox permanent rejection (550, 551, 552, 553)
    if (
      ['550', '551', '552', '553'].includes(code) ||
      msg.includes('550') ||
      msg.toLowerCase().includes('recipient address rejected') ||
      msg.toLowerCase().includes('user unknown')
    ) {
      return true;
    }

    // Payload validation, corruption, and permanently missing entities
    if (
      msg.includes('Invalid email') ||
      msg.includes('required') ||
      msg.includes('Unknown email job type') ||
      msg.includes('Corrupted delivery secret') ||
      msg.includes('not found in database') ||
      msg.includes('has expired')
    ) {
      return true;
    }

    return false;
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
