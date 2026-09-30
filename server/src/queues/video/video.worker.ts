import { Worker, Job, UnrecoverableError } from 'bullmq';
import { VIDEO_QUEUE } from '../queue-names.js';
import { createRedisClient } from '../../infrastructure/redis/redis.js';
import { VideoJobData, VideoJobType } from '../types.js';
import { prisma } from '../../db/prisma.js';
import { createAuditLog } from '../../modules/audit/audit.service.js';
import { videoProviderFactory } from '../../modules/videos/video-provider.factory.js';
import { env } from '../../config/env.js';

export class VideoWorker {
  private worker: Worker<VideoJobData>;

  constructor() {
    const redisConnection = createRedisClient();

    this.worker = new Worker<VideoJobData>(
      VIDEO_QUEUE,
      async (job: Job<VideoJobData>) => {
        const startTime = Date.now();
        const { type } = job.data;

        const timeStr = new Date().toISOString().substring(11, 19);
        console.log(`[${timeStr} UTC] INFO  job ${VIDEO_QUEUE} ${type} started (attempt=${job.attemptsMade + 1})`);

        try {
          await this.processJob(job);
          const duration = Date.now() - startTime;
          console.log(`[${timeStr} UTC] INFO  job ${VIDEO_QUEUE} ${type} completed ${duration}ms`);
        } catch (error: any) {
          console.error(
            `[${timeStr} UTC] ERROR job ${VIDEO_QUEUE} ${type} failed (attempt=${job.attemptsMade + 1}/${job.opts.attempts || 3}):`,
            error.message
          );
          throw error;
        }
      },
      {
        connection: redisConnection,
        concurrency: env.WORKER_CONCURRENCY_VIDEO || 3,
        prefix: env.NODE_ENV === 'test' ? 'bull:test' : (env.BULLMQ_PREFIX || 'bull'),
      }
    );

    this.worker.on('error', (err) => {
      console.error(`[VideoWorker] Worker error:`, err.message);
    });
  }

  private async processJob(job: Job<VideoJobData>): Promise<void> {
    const data = job.data;

    switch (data.type) {
      case VideoJobType.VIDEO_READY: {
        const { videoAssetId, targetLessonId, replacesAssetId, playbackId, durationSeconds } = data;

        // Verify VideoAsset exists in PostgreSQL (Source of Truth)
        const asset = await prisma.videoAsset.findUnique({
          where: { id: videoAssetId },
        });

        if (!asset) {
          console.warn(`[VideoWorker] VideoAsset ${videoAssetId} not found in DB, skipping VIDEO_READY job.`);
          return;
        }

        const expectedAction = replacesAssetId ? 'VIDEO_REPLACED' : 'VIDEO_READY';

        if (targetLessonId) {
          const targetLesson = await prisma.lesson.findUnique({
            where: { id: targetLessonId },
            select: { id: true },
          });

          if (!targetLesson) {
            console.warn(`[VideoWorker] Target lesson ${targetLessonId} not found in DB, skipping VIDEO_READY for lesson.`);
            return;
          }

          // 1. Idempotent lesson duration synchronization
          if (durationSeconds) {
            await prisma.lesson.update({
              where: { id: targetLessonId },
              data: { videoDurationSeconds: durationSeconds },
            });
          }

          // 2. Database-backed idempotency check for audit log
          // Ensures retries do not create duplicate audit events
          const existingAudit = await prisma.auditLog.findFirst({
            where: {
              action: expectedAction,
              entityType: 'Lesson',
              entityId: targetLessonId,
              metadata: {
                contains: videoAssetId,
              },
            },
          });

          if (!existingAudit) {
            await createAuditLog({
              actorUserId: undefined,
              action: expectedAction,
              entityType: 'Lesson',
              entityId: targetLessonId,
              metadata: {
                videoAssetId,
                playbackId,
                durationSeconds,
                replacesAssetId,
              },
            });
          }
        } else {
          // Attach/sync to all lessons pointing to this video asset
          const lessons = await prisma.lesson.findMany({ where: { videoId: videoAssetId } });
          for (const lesson of lessons) {
            if (durationSeconds) {
              await prisma.lesson.update({
                where: { id: lesson.id },
                data: { videoDurationSeconds: durationSeconds },
              });
            }

            const existingAudit = await prisma.auditLog.findFirst({
              where: {
                action: 'VIDEO_READY',
                entityType: 'Lesson',
                entityId: lesson.id,
                metadata: {
                  contains: videoAssetId,
                },
              },
            });

            if (!existingAudit) {
              await createAuditLog({
                actorUserId: undefined,
                action: 'VIDEO_READY',
                entityType: 'Lesson',
                entityId: lesson.id,
                metadata: {
                  videoAssetId,
                  playbackId,
                  durationSeconds,
                },
              });
            }
          }
        }
        break;
      }

      case VideoJobType.VIDEO_FAILED: {
        const { videoAssetId, providerVideoId, errorMessage } = data;

        const asset = await prisma.videoAsset.findUnique({
          where: { id: videoAssetId },
          select: { id: true },
        });

        if (!asset) {
          console.warn(`[VideoWorker] VideoAsset ${videoAssetId} not found in DB, skipping VIDEO_FAILED.`);
          return;
        }

        // Idempotency check: verify whether failure was already logged
        const existingFailureLog = await prisma.auditLog.findFirst({
          where: {
            action: 'VIDEO_PROCESSING_FAILED',
            entityType: 'VideoAsset',
            entityId: videoAssetId,
          },
        });

        if (!existingFailureLog) {
          await createAuditLog({
            actorUserId: undefined,
            action: 'VIDEO_PROCESSING_FAILED',
            entityType: 'VideoAsset',
            entityId: videoAssetId,
            metadata: {
              providerVideoId,
              errorMessage,
            },
          });
        }
        break;
      }

      case VideoJobType.VIDEO_CLEANUP: {
        const { provider, providerVideoId } = data;

        if (!providerVideoId) {
          throw new UnrecoverableError('VIDEO_CLEANUP skipped: missing providerVideoId');
        }

        try {
          // Explicit targeting: strictly delete the exact providerVideoId created for this job.
          // Never infer "current video" from database state to prevent race conditions during replacements.
          const videoProvider = videoProviderFactory.getProvider(provider);
          await videoProvider.deleteVideo(providerVideoId);
          console.log(`[VideoWorker] Cleaned up provider video ${providerVideoId} from ${provider}`);
        } catch (err: any) {
          console.warn(`[VideoWorker] Provider cleanup warning for ${providerVideoId}:`, err.message);
          throw err;
        }
        break;
      }

      default: {
        throw new Error(`Unknown video job type: ${(data as any).type}`);
      }
    }
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
