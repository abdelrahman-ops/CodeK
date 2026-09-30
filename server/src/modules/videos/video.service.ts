import { prisma } from '../../db/prisma.js';
import { videoProviderFactory } from './video-provider.factory.js';
import {
  CreateDirectUploadInput,
  ConfirmUploadInput,
  ConnectExternalVideoInput
} from './video.schema.js';
import { canAccessLesson } from '../lessons/lesson-access.service.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors/app-error.js';
import { PlaybackInfo } from './video-provider.interface.js';
import { VideoAssetStatus, Role } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service.js';
import { MuxVideoProvider } from './providers/mux-video.provider.js';
import { getStudentGrade, assertGradeAccess } from '../curriculum/curriculum-auth.js';
import { videoQueue } from '../../queues/video/video.queue.js';

export async function createDirectUploadSession(input: CreateDirectUploadInput, adminUserId?: string) {
  const provider = videoProviderFactory.getProvider();

  // Request authenticated direct upload URL from active provider (Mux default configured with signed playback)
  const uploadResult = await provider.createDirectUpload({
    maxDurationSeconds: input.maxDurationSeconds || 3600,
    requireSignedPlayback: input.isPrivate ?? true,
    meta: {
      lessonId: input.lessonId,
      title: input.title
    }
  });

  // Store metadata record in PostgreSQL (Never the video binary itself!)
  const asset = await prisma.videoAsset.create({
    data: {
      provider: provider.name,
      providerVideoId: uploadResult.providerVideoId,
      uploadId: uploadResult.providerVideoId,
      title: input.title || 'Untitled Lesson Video',
      isPrivate: input.isPrivate ?? true,
      status: VideoAssetStatus.PENDING_UPLOAD,
      metadata: input.lessonId ? { targetLessonId: input.lessonId } : undefined
    }
  });

  // Safe replacement logic:
  // If lesson already has a working video, do NOT overwrite lesson.videoId immediately!
  // Keep the existing video active until the new upload reaches READY status.
  if (input.lessonId) {
    const lesson = await prisma.lesson.findUnique({ where: { id: input.lessonId } });
    if (lesson) {
      if (!lesson.videoId) {
        // No current video: attach immediately so admin sees pending/uploading status
        await prisma.lesson.update({
          where: { id: input.lessonId },
          data: { videoId: asset.id }
        });
      } else {
        // Replacing existing video: track target lesson and old asset to swap safely on asset.ready
        await prisma.videoAsset.update({
          where: { id: asset.id },
          data: {
            metadata: {
              targetLessonId: input.lessonId,
              replacesAssetId: lesson.videoId
            }
          }
        });
      }
    }
  }

  if (adminUserId) {
    await createAuditLog({
      actorUserId: adminUserId,
      action: 'VIDEO_UPLOAD_STARTED',
      entityType: 'VideoAsset',
      entityId: asset.id,
      metadata: {
        lessonId: input.lessonId,
        provider: provider.name,
        uploadId: uploadResult.providerVideoId
      }
    });
  }

  return {
    videoAssetId: asset.id,
    provider: provider.name,
    providerVideoId: uploadResult.providerVideoId,
    uploadUrl: uploadResult.uploadUrl,
    expiresAt: uploadResult.expiresAt,
    isDirectPost: uploadResult.isDirectPost,
    headers: uploadResult.headers
  };
}

export async function confirmUploadComplete(input: ConfirmUploadInput) {
  const asset = await prisma.videoAsset.findUnique({
    where: { id: input.videoAssetId }
  });

  if (!asset) {
    throw new NotFoundError('Video asset not found');
  }

  const provider = videoProviderFactory.getProvider(asset.provider);
  const metadata = await provider.getVideoMetadata(asset.uploadId || asset.providerVideoId);

  const raw = metadata.raw as any;
  const playbackId = raw?.playbackId || (asset.provider === 'MOCK' ? asset.providerVideoId : undefined);
  const providerVideoId = metadata.providerVideoId || asset.providerVideoId;

  const updatedAsset = await prisma.videoAsset.update({
    where: { id: asset.id },
    data: {
      providerVideoId,
      playbackId: playbackId || asset.playbackId,
      status: (metadata.status as VideoAssetStatus) || asset.status,
      durationSeconds: metadata.durationSeconds || asset.durationSeconds,
      thumbnailUrl: metadata.thumbnailUrl || asset.thumbnailUrl,
      metadata: metadata.raw ? (metadata.raw as any) : undefined
    }
  });

  if (input.lessonId) {
    await prisma.lesson.update({
      where: { id: input.lessonId },
      data: {
        videoId: updatedAsset.id,
        videoDurationSeconds: updatedAsset.durationSeconds || undefined
      }
    });
  }

  return updatedAsset;
}

export async function connectExternalVideo(input: ConnectExternalVideoInput) {
  const provider = videoProviderFactory.getProvider('EXTERNAL');
  const playbackInfo = await provider.getPlaybackInfo(input.url);

  const asset = await prisma.videoAsset.create({
    data: {
      provider: 'EXTERNAL',
      providerVideoId: input.url,
      title: input.title || 'External Video Resource',
      playbackUrl: playbackInfo.playbackUrl,
      thumbnailUrl: playbackInfo.thumbnailUrl,
      durationSeconds: input.durationSeconds || undefined,
      isPrivate: false,
      status: VideoAssetStatus.READY
    }
  });

  if (input.lessonId) {
    await prisma.lesson.update({
      where: { id: input.lessonId },
      data: {
        videoId: asset.id,
        videoUrl: input.url,
        videoDurationSeconds: input.durationSeconds || undefined
      }
    });
  }

  return asset;
}

export async function getVideoAssetById(id: string) {
  const asset = await prisma.videoAsset.findUnique({
    where: { id },
    include: {
      lessons: {
        select: { id: true, title: true, curriculumId: true }
      }
    }
  });

  if (!asset) {
    throw new NotFoundError('Video asset not found');
  }

  // Only generate signed preview authorization if the video is READY and has playback identifier
  let playback: any = null;
  const isReady = asset.status === VideoAssetStatus.READY;
  const hasPlaybackId = Boolean(asset.playbackId || asset.provider === 'EXTERNAL' || asset.provider === 'MOCK');

  if (isReady && hasPlaybackId && asset.providerVideoId) {
    try {
      const provider = videoProviderFactory.getProvider(asset.provider);
      playback = await provider.getPlaybackInfo(asset.providerVideoId, {
        playbackId: asset.playbackId || undefined,
        durationSeconds: asset.durationSeconds || undefined,
        requireSignedPlayback: asset.isPrivate
      });
    } catch {
      // Gracefully handle playback resolution failure; previewPlayback remains null
    }
  }

  return {
    ...asset,
    playbackUrl: playback?.playbackUrl || (isReady ? asset.playbackUrl : null),
    previewPlayback: playback
  };
}

export async function attachVideoToLesson(lessonId: string, videoAssetId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new NotFoundError('Lesson not found');

  const asset = await prisma.videoAsset.findUnique({ where: { id: videoAssetId } });
  if (!asset) throw new NotFoundError('Video asset not found');

  const updated = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      videoId: asset.id,
      videoDurationSeconds: asset.durationSeconds || lesson.videoDurationSeconds
    },
    include: {
      video: true
    }
  });

  return updated;
}

export async function detachVideoFromLesson(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new NotFoundError('Lesson not found');

  const updated = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      videoId: null
    }
  });

  return updated;
}

export async function deleteVideoAsset(id: string) {
  const asset = await prisma.videoAsset.findUnique({ where: { id } });
  if (!asset) throw new NotFoundError('Video asset not found');

  // Detach from all lessons first
  await prisma.lesson.updateMany({
    where: { videoId: id },
    data: { videoId: null }
  });

  // Enqueue asynchronous provider deletion via BullMQ
  await videoQueue.enqueueVideoCleanup({
    provider: asset.provider,
    providerVideoId: asset.providerVideoId,
    videoAssetId: id
  });

  // Also call provider deletion directly with graceful catch
  try {
    const provider = videoProviderFactory.getProvider(asset.provider);
    await provider.deleteVideo(asset.providerVideoId);
  } catch (err: any) {
    // Already enqueued to background queue for retries
  }

  await prisma.videoAsset.delete({ where: { id } });
  return { success: true };
}

/**
 * Authoritative Student Video Playback Endpoint.
 * Strictly verifies user authentication, role, lesson existence, and central access gating.
 * Issues short-lived, RS256 signed playback token for private Mux assets.
 */
export async function getLessonPlaybackInfo(lessonId: string, user: any): Promise<PlaybackInfo | { playbackUrl: null }> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      video: true,
      curriculum: true
    }
  });

  if (!lesson) {
    throw new NotFoundError('Lesson not found');
  }

  // 1. Grade Isolation: strictly reject access to other grade's videos (404 Not Found)
  if (user?.role === Role.STUDENT && (user.studentId || user.student?.id)) {
    const studentId = user.studentId || user.student?.id;
    const studentGrade = await getStudentGrade(studentId);
    assertGradeAccess(studentGrade, lesson.curriculum.grade, 'Lesson');
  }

  // 2. Financial / Access Entitlement (attendance + subscription check)
  const access = await canAccessLesson(user, lesson);
  if (!access.canAccess) {
    const message = user?.role === 'STUDENT' ? access.messageAr : access.messageEn;
    throw new ForbiddenError(message || 'This lesson video is locked and inaccessible.');
  }

  // 1. Managed VideoAsset
  if (lesson.video) {
    if (lesson.video.status === VideoAssetStatus.ERROR) {
      throw new BadRequestError('The video for this lesson failed processing.');
    }
    if (lesson.video.status === VideoAssetStatus.PROCESSING || lesson.video.status === VideoAssetStatus.PENDING_UPLOAD) {
      throw new BadRequestError('The video for this lesson is currently being processed.');
    }

    const provider = videoProviderFactory.getProvider(lesson.video.provider);
    return provider.getPlaybackInfo(lesson.video.providerVideoId, {
      playbackId: lesson.video.playbackId || undefined,
      durationSeconds: lesson.video.durationSeconds || undefined,
      requireSignedPlayback: lesson.video.isPrivate,
      userContext: {
        userId: user.id,
        studentId: user.student?.id
      }
    });
  }

  // 2. Legacy fallback videoUrl
  if (lesson.videoUrl) {
    const externalProvider = videoProviderFactory.getProvider('EXTERNAL');
    return externalProvider.getPlaybackInfo(lesson.videoUrl);
  }

  // 3. No video on lesson
  return { playbackUrl: null };
}

/**
 * Retrieves video status for admin lesson management.
 */
export async function getLessonVideoStatus(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { video: true }
  });

  if (!lesson) {
    throw new NotFoundError('Lesson not found');
  }

  return {
    lessonId: lesson.id,
    video: lesson.video ? {
      id: lesson.video.id,
      provider: lesson.video.provider,
      status: lesson.video.status,
      playbackId: lesson.video.playbackId,
      durationSeconds: lesson.video.durationSeconds,
      thumbnailUrl: lesson.video.thumbnailUrl,
      errorMessage: lesson.video.errorMessage,
      createdAt: lesson.video.createdAt
    } : null
  };
}

/**
 * Removes a video from a lesson safely (Admin).
 */
export async function removeLessonVideo(lessonId: string, adminUserId?: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { video: true }
  });

  if (!lesson) {
    throw new NotFoundError('Lesson not found');
  }

  const previousVideoId = lesson.videoId;

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      videoId: null,
      videoDurationSeconds: null,
      videoUrl: null
    }
  });

  if (previousVideoId && lesson.video) {
    const provider = videoProviderFactory.getProvider(lesson.video.provider);
    try {
      await provider.deleteVideo(lesson.video.providerVideoId);
    } catch {
      // Ignore external provider deletion error
    }

    await prisma.videoAsset.delete({
      where: { id: previousVideoId }
    }).catch(() => {});
  }

  if (adminUserId) {
    await createAuditLog({
      actorUserId: adminUserId,
      action: 'VIDEO_REMOVED',
      entityType: 'Lesson',
      entityId: lessonId,
      metadata: {
        removedVideoAssetId: previousVideoId
      }
    });
  }

  return { success: true };
}

/**
 * Idempotent Mux Webhook Processor.
 * Verifies mux-signature using the raw request body.
 * Handles:
 * - video.upload.asset_created
 * - video.asset.ready (safely performs atomic lesson video replacement)
 * - video.asset.errored
 */
export async function handleMuxWebhook(rawBody: string, headers: Record<string, any>) {
  const provider = videoProviderFactory.getProvider('MUX') as MuxVideoProvider;
  const muxClient = provider.getMuxClient();
  const webhookSecret = provider.getWebhookSecret();

  if (!webhookSecret) {
    throw new Error('MUX_WEBHOOK_SECRET is not configured');
  }

  // Official Mux webhook signature verification (throws if invalid)
  const event = await muxClient.webhooks.unwrap(rawBody, headers, webhookSecret);
  const eventType = event.type;
  const eventData = event.data as any;

  switch (eventType) {
    case 'video.upload.asset_created': {
      const uploadId = eventData?.id;
      const assetId = eventData?.asset_id;

      if (uploadId && assetId) {
        const videoAsset = await prisma.videoAsset.findFirst({
          where: {
            OR: [
              { uploadId },
              { providerVideoId: uploadId }
            ]
          }
        });

        if (videoAsset) {
          await prisma.videoAsset.update({
            where: { id: videoAsset.id },
            data: {
              providerVideoId: assetId,
              status: VideoAssetStatus.PROCESSING
            }
          });
        }
      }
      break;
    }

    case 'video.asset.ready': {
      const assetId = eventData?.id;
      const uploadId = eventData?.upload_id;
      const durationSeconds = eventData?.duration ? Math.round(eventData.duration) : null;
      const signedPlayback = eventData?.playback_ids?.find((p: any) => p.policy === 'signed');
      const playbackId = signedPlayback?.id || eventData?.playback_ids?.[0]?.id;

      const videoAsset = await prisma.videoAsset.findFirst({
        where: {
          OR: [
            { providerVideoId: assetId },
            ...(uploadId ? [{ uploadId }] : [])
          ]
        }
      });

      if (videoAsset) {
        // Idempotency: If already marked READY with the same playbackId, avoid duplicate side-effects
        if (videoAsset.status === VideoAssetStatus.READY && videoAsset.playbackId === playbackId) {
          return { received: true, idempotent: true };
        }

        const updatedAsset = await prisma.videoAsset.update({
          where: { id: videoAsset.id },
          data: {
            providerVideoId: assetId,
            playbackId: playbackId || null,
            durationSeconds: durationSeconds || videoAsset.durationSeconds,
            status: VideoAssetStatus.READY,
            playbackUrl: playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : videoAsset.playbackUrl,
            thumbnailUrl: playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : videoAsset.thumbnailUrl,
            errorMessage: null
          }
        });

        const meta = (updatedAsset.metadata as any) || {};
        const targetLessonId = meta.targetLessonId;

        if (targetLessonId) {
          // Atomic update of lesson to the newly ready video
          await prisma.lesson.update({
            where: { id: targetLessonId },
            data: {
              videoId: updatedAsset.id,
              videoDurationSeconds: updatedAsset.durationSeconds || undefined
            }
          });

          await createAuditLog({
            actorUserId: undefined,
            action: meta.replacesAssetId ? 'VIDEO_REPLACED' : 'VIDEO_READY',
            entityType: 'Lesson',
            entityId: targetLessonId,
            metadata: {
              videoAssetId: updatedAsset.id,
              playbackId,
              durationSeconds: updatedAsset.durationSeconds,
              replacedAssetId: meta.replacesAssetId
            }
          });
        } else {
          const lessons = await prisma.lesson.findMany({ where: { videoId: updatedAsset.id } });
          for (const lesson of lessons) {
            await prisma.lesson.update({
              where: { id: lesson.id },
              data: {
                videoDurationSeconds: updatedAsset.durationSeconds || undefined
              }
            });

            await createAuditLog({
              actorUserId: undefined,
              action: 'VIDEO_READY',
              entityType: 'Lesson',
              entityId: lesson.id,
              metadata: {
                videoAssetId: updatedAsset.id,
                playbackId,
                durationSeconds: updatedAsset.durationSeconds
              }
            });
          }
        }

        // Enqueue background processing job via BullMQ
        await videoQueue.enqueueVideoReady({
          videoAssetId: updatedAsset.id,
          providerVideoId: assetId,
          playbackId,
          durationSeconds: updatedAsset.durationSeconds,
          targetLessonId,
          replacesAssetId: meta.replacesAssetId
        });
      }
      break;
    }

    case 'video.asset.errored': {
      const assetId = eventData?.id;
      const uploadId = eventData?.upload_id;
      const errorMsg = eventData?.errors?.messages?.join(', ') || 'Mux video processing failed';

      const videoAsset = await prisma.videoAsset.findFirst({
        where: {
          OR: [
            { providerVideoId: assetId },
            ...(uploadId ? [{ uploadId }] : [])
          ]
        }
      });

      if (videoAsset) {
        await prisma.videoAsset.update({
          where: { id: videoAsset.id },
          data: {
            status: VideoAssetStatus.ERROR,
            errorMessage: errorMsg
          }
        });

        await createAuditLog({
          actorUserId: undefined,
          action: 'VIDEO_FAILED',
          entityType: 'VideoAsset',
          entityId: videoAsset.id,
          metadata: {
            assetId,
            uploadId,
            error: errorMsg
          }
        });

        // Enqueue background failure job via BullMQ
        await videoQueue.enqueueVideoFailed({
          videoAssetId: videoAsset.id,
          providerVideoId: assetId || videoAsset.providerVideoId,
          errorMessage: errorMsg
        });
      }
      break;
    }
  }

  return { received: true };
}
