import { Queue } from 'bullmq';
import { VIDEO_QUEUE } from '../queue-names.js';
import { getOrCreateQueue } from '../queue-factory.js';
import {
  VideoJobData,
  VideoJobType,
  VideoReadyJobData,
  VideoFailedJobData,
  VideoCleanupJobData,
} from '../types.js';
import { env } from '../../config/env.js';

export class VideoQueueServiceUnavailableError extends Error {
  statusCode = 503;
  code = 'QUEUE_UNAVAILABLE';
  constructor(message: string) {
    super(message);
    this.name = 'VideoQueueServiceUnavailableError';
  }
}

export class VideoQueue {
  private queue: Queue<VideoJobData>;

  constructor() {
    this.queue = getOrCreateQueue<VideoJobData>(VIDEO_QUEUE);
  }

  /**
   * Enqueues a video ready post-processing job (after Mux webhook marks asset READY).
   */
  async enqueueVideoReady(payload: {
    videoAssetId: string;
    providerVideoId: string;
    playbackId?: string | null;
    durationSeconds?: number | null;
    targetLessonId?: string | null;
    replacesAssetId?: string | null;
  }): Promise<string | null> {
    const jobData: VideoReadyJobData = {
      type: VideoJobType.VIDEO_READY,
      ...payload,
    };

    try {
      // Deterministic job ID prevents duplicate processing if Mux delivers duplicated webhooks
      const jobId = `video_ready_${payload.videoAssetId}_${payload.providerVideoId}`;
      const job = await this.queue.add(VideoJobType.VIDEO_READY, jobData, { jobId });
      return job.id || null;
    } catch (err: any) {
      if (env.NODE_ENV === 'production') {
        console.error(`[VideoQueue] Production Redis failure enqueueing VIDEO_READY:`, err.message);
        throw new VideoQueueServiceUnavailableError('Queue service unavailable: failed to enqueue VIDEO_READY');
      }

      console.warn(`[VideoQueue] (DEV/TEST ONLY) Failed to enqueue VIDEO_READY via Redis:`, err.message);
      return null;
    }
  }

  /**
   * Enqueues a video failed job (after Mux webhook marks asset ERROR).
   */
  async enqueueVideoFailed(payload: {
    videoAssetId: string;
    providerVideoId: string;
    errorMessage: string;
  }): Promise<string | null> {
    const jobData: VideoFailedJobData = {
      type: VideoJobType.VIDEO_FAILED,
      ...payload,
    };

    try {
      const jobId = `video_failed_${payload.videoAssetId}_${payload.providerVideoId}`;
      const job = await this.queue.add(VideoJobType.VIDEO_FAILED, jobData, { jobId });
      return job.id || null;
    } catch (err: any) {
      if (env.NODE_ENV === 'production') {
        console.error(`[VideoQueue] Production Redis failure enqueueing VIDEO_FAILED:`, err.message);
        throw new VideoQueueServiceUnavailableError('Queue service unavailable: failed to enqueue VIDEO_FAILED');
      }

      console.warn(`[VideoQueue] (DEV/TEST ONLY) Failed to enqueue VIDEO_FAILED via Redis:`, err.message);
      return null;
    }
  }

  /**
   * Enqueues an asynchronous video cleanup / provider deletion job.
   */
  async enqueueVideoCleanup(payload: {
    provider: string;
    providerVideoId: string;
    videoAssetId?: string;
  }): Promise<string | null> {
    if (!payload.providerVideoId) {
      throw new Error('Video cleanup requires a non-empty providerVideoId');
    }

    const jobData: VideoCleanupJobData = {
      type: VideoJobType.VIDEO_CLEANUP,
      ...payload,
    };

    try {
      const jobId = `video_cleanup_${payload.provider}_${payload.providerVideoId}`;
      const job = await this.queue.add(VideoJobType.VIDEO_CLEANUP, jobData, { jobId });
      return job.id || null;
    } catch (err: any) {
      if (env.NODE_ENV === 'production') {
        console.error(`[VideoQueue] Production Redis failure enqueueing VIDEO_CLEANUP:`, err.message);
        throw new VideoQueueServiceUnavailableError('Queue service unavailable: failed to enqueue VIDEO_CLEANUP');
      }

      console.warn(`[VideoQueue] (DEV/TEST ONLY) Failed to enqueue VIDEO_CLEANUP via Redis:`, err.message);
      return null;
    }
  }

  getRawQueue(): Queue<VideoJobData> {
    return this.queue;
  }
}

export const videoQueue = new VideoQueue();
