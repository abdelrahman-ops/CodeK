import { describe, it, expect, beforeAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { videoProviderFactory } from '../src/modules/videos/video-provider.factory.js';
import { MuxVideoProvider } from '../src/modules/videos/providers/mux-video.provider.js';
import { LessonAccessType, Role, VideoAssetStatus } from '@prisma/client';
import Mux from '@mux/mux-node';

describe('Production-Ready Secure Video Delivery with Mux', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUserId: string;
  let studentToken: string;
  let studentUserId: string;
  let studentId: string;

  let testCourseId: string;
  let freeLessonId: string;
  let paidLessonId: string;
  let attendanceLockedLessonId: string;

  // Cryptographic In-Memory Test Keys
  const testWebhookSecret = 'test_mux_webhook_secret_12345';
  const testKeyId = 'mux_test_key_id_99';
  const { privateKey: testPrivateKeyPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Track Mux API invocations
  let lastUploadParams: any = null;

  // Helper to construct valid Mux Webhook Signature
  function generateMuxSignatureHeader(payload: string, secret: string = testWebhookSecret): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  beforeAll(async () => {
    process.env.VIDEO_PROVIDER = 'MUX';
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    const adminUser = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    adminUserId = adminUser!.id;

    // Student login (STU-1001)
    const studentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    studentToken = studentRes.json().data.accessToken;
    studentUserId = studentRes.json().data.user.id;
    studentId = studentRes.json().data.user.student.id;

    // Remove subscriptions for clean access tests
    await prisma.subscription.deleteMany({ where: { studentId } });
    await prisma.educationalAccessGrant.deleteMany({ where: { studentId } });

    // Mock Mux Client without external network calls
    const mockMuxClient = new Mux({
      tokenId: 'test_token_id',
      tokenSecret: 'test_token_secret',
      webhookSecret: testWebhookSecret
    });

    // Mock uploads.create
    mockMuxClient.video.uploads.create = vi.fn().mockImplementation(async (params) => {
      lastUploadParams = params;
      return {
        id: `mux_upload_${Date.now()}`,
        url: `https://upload.mux.com/test_upload_url_${Date.now()}`
      };
    });

    // Register Mock-Backed Mux Provider
    const testMuxProvider = new MuxVideoProvider({
      tokenId: 'test_token_id',
      tokenSecret: 'test_token_secret',
      signingKeyId: testKeyId,
      signingPrivateKey: testPrivateKeyPem,
      webhookSecret: testWebhookSecret,
      client: mockMuxClient
    });
    videoProviderFactory.registerProvider(testMuxProvider);

    // Setup Test Course and Lessons
    const unique = Date.now();
    const course = await prisma.curriculum.create({
      data: {
        code: `MUX-CRS-${unique}`,
        title: `Mux Video Course ${unique}`,
        description: 'Testing secure Mux streaming'
      }
    });
    testCourseId = course.id;

    // 1. Free Preview Lesson
    const freeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: testCourseId,
        title: 'Free Preview Mux Lesson',
        content: '# Free Content',
        isFree: true,
        accessType: LessonAccessType.FREE
      }
    });
    freeLessonId = freeRes.json().data.id;

    // 2. Paid Subscription Required Lesson
    const paidRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: testCourseId,
        title: 'Paid Exclusive Mux Lesson',
        content: '# Exclusive Paid Content',
        isFree: false,
        accessType: LessonAccessType.SUBSCRIPTION_REQUIRED
      }
    });
    paidLessonId = paidRes.json().data.id;

    // 3. Attendance Locked Lesson (linked to session with no attendance record)
    const attRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: testCourseId,
        title: 'Attendance Gated Mux Lesson',
        content: '# Attendance Locked Content',
        isFree: false,
        accessType: LessonAccessType.ATTENDANCE_REQUIRED
      }
    });
    attendanceLockedLessonId = attRes.json().data.id;

    const group = await prisma.group.create({
      data: { name: `Attendance Test Cohort ${unique}` }
    });
    const session = await prisma.session.create({
      data: {
        groupId: group.id,
        sessionNumber: 1,
        date: new Date(),
        startTime: '10:00',
        endTime: '12:00',
        sessionLessons: {
          create: [{ lessonId: attendanceLockedLessonId, order: 1 }]
        }
      }
    });
  });

  describe('1. Direct Upload Authorization & Security', () => {
    let createdUploadId: string;
    let createdAssetId: string;

    it('Admin can request a video upload URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/lessons/${freeLessonId}/video/upload-url`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      expect(data.uploadUrl).toMatch(/^https:\/\/upload\.mux\.com\//);
      expect(data.providerVideoId).toMatch(/^mux_upload_/);
      expect(data.videoAssetId).toBeDefined();

      createdUploadId = data.providerVideoId;
      createdAssetId = data.videoAssetId;
    });

    it('Non-admin cannot request upload URL (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/lessons/${freeLessonId}/video/upload-url`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(403);
    });

    it('Upload URL is associated with the correct lesson', async () => {
      const asset = await prisma.videoAsset.findUnique({ where: { id: createdAssetId } });
      expect(asset).toBeDefined();
      expect(asset?.uploadId).toBe(createdUploadId);
      expect(asset?.status).toBe(VideoAssetStatus.PENDING_UPLOAD);

      const lesson = await prisma.lesson.findUnique({ where: { id: freeLessonId } });
      expect(lesson?.videoId).toBe(createdAssetId);
    });

    it('Mux asset is configured for signed playback (never public)', async () => {
      expect(lastUploadParams).toBeDefined();
      expect(lastUploadParams.new_asset_settings).toBeDefined();
      expect(lastUploadParams.new_asset_settings.playback_policy).toEqual(['signed']);
      expect(lastUploadParams.new_asset_settings.playback_policy).not.toContain('public');
    });
  });

  describe('2. Webhook Verification & Lifecycle State Machine', () => {
    let webhookUploadId: string;
    let webhookAssetId: string;
    let dbVideoAssetId: string;

    beforeAll(async () => {
      webhookUploadId = `upload_live_${Date.now()}`;
      webhookAssetId = `mux_asset_${Date.now()}`;

      // Create a pending video asset for webhook tests
      const asset = await prisma.videoAsset.create({
        data: {
          provider: 'MUX',
          providerVideoId: webhookUploadId,
          uploadId: webhookUploadId,
          title: 'Webhook Test Asset',
          status: VideoAssetStatus.PENDING_UPLOAD,
          isPrivate: true,
          metadata: { targetLessonId: paidLessonId }
        }
      });
      dbVideoAssetId = asset.id;
    });

    it('Mux webhook rejects invalid signatures (400 Bad Request)', async () => {
      const payload = JSON.stringify({
        type: 'video.upload.asset_created',
        data: { id: webhookUploadId, asset_id: webhookAssetId }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/mux',
        headers: {
          'Content-Type': 'application/json',
          'mux-signature': 't=1234567890,v1=tampered_invalid_signature_hex'
        },
        payload
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Webhook verification failed');
    });

    it('Mux webhook accepts valid signatures', async () => {
      const payload = JSON.stringify({
        type: 'video.upload.asset_created',
        data: { id: webhookUploadId, asset_id: webhookAssetId }
      });

      const validSignature = generateMuxSignatureHeader(payload);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/mux',
        headers: {
          'Content-Type': 'application/json',
          'mux-signature': validSignature
        },
        payload
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().received).toBe(true);

      const asset = await prisma.videoAsset.findUnique({ where: { id: dbVideoAssetId } });
      expect(asset?.status).toBe(VideoAssetStatus.PROCESSING);
      expect(asset?.providerVideoId).toBe(webhookAssetId);
    });

    it('video.asset.ready updates the lesson correctly', async () => {
      const playbackId = `signed_playback_${Date.now()}`;
      const payload = JSON.stringify({
        type: 'video.asset.ready',
        data: {
          id: webhookAssetId,
          upload_id: webhookUploadId,
          duration: 345.67,
          status: 'ready',
          playback_ids: [{ id: playbackId, policy: 'signed' }]
        }
      });

      const signature = generateMuxSignatureHeader(payload);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/mux',
        headers: {
          'Content-Type': 'application/json',
          'mux-signature': signature
        },
        payload
      });

      expect(res.statusCode).toBe(200);

      const asset = await prisma.videoAsset.findUnique({ where: { id: dbVideoAssetId } });
      expect(asset?.status).toBe(VideoAssetStatus.READY);
      expect(asset?.playbackId).toBe(playbackId);
      expect(asset?.durationSeconds).toBe(346);

      // Verify target lesson was atomically connected
      const lesson = await prisma.lesson.findUnique({ where: { id: paidLessonId } });
      expect(lesson?.videoId).toBe(dbVideoAssetId);
      expect(lesson?.videoDurationSeconds).toBe(346);

      // Verify audit log was recorded
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: paidLessonId, action: 'VIDEO_READY' },
        orderBy: { createdAt: 'desc' }
      });
      expect(audit).toBeDefined();
      const meta = typeof audit?.metadata === 'string' ? JSON.parse(audit.metadata) : audit?.metadata;
      expect(meta).toMatchObject({ playbackId });
    });

    it('Duplicate webhook events are safe/idempotent', async () => {
      const asset = await prisma.videoAsset.findUnique({ where: { id: dbVideoAssetId } });
      const payload = JSON.stringify({
        type: 'video.asset.ready',
        data: {
          id: webhookAssetId,
          upload_id: webhookUploadId,
          duration: 345.67,
          status: 'ready',
          playback_ids: [{ id: asset?.playbackId, policy: 'signed' }]
        }
      });

      const signature = generateMuxSignatureHeader(payload);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/mux',
        headers: {
          'Content-Type': 'application/json',
          'mux-signature': signature
        },
        payload
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().idempotent).toBe(true);
    });

    it('video.asset.errored marks the video as failed', async () => {
      const failedUploadId = `upload_err_${Date.now()}`;
      const failedAssetId = `asset_err_${Date.now()}`;

      const asset = await prisma.videoAsset.create({
        data: {
          provider: 'MUX',
          providerVideoId: failedUploadId,
          uploadId: failedUploadId,
          title: 'Error Test Video',
          status: VideoAssetStatus.PROCESSING,
          isPrivate: true
        }
      });

      const payload = JSON.stringify({
        type: 'video.asset.errored',
        data: {
          id: failedAssetId,
          upload_id: failedUploadId,
          errors: {
            type: 'invalid_input',
            messages: ['Corrupt video header']
          }
        }
      });

      const signature = generateMuxSignatureHeader(payload);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/mux',
        headers: {
          'Content-Type': 'application/json',
          'mux-signature': signature
        },
        payload
      });

      expect(res.statusCode).toBe(200);

      const updated = await prisma.videoAsset.findUnique({ where: { id: asset.id } });
      expect(updated?.status).toBe(VideoAssetStatus.ERROR);
      expect(updated?.errorMessage).toContain('Corrupt video header');

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: asset.id, action: 'VIDEO_FAILED' }
      });
      expect(audit).toBeDefined();
    });
  });

  describe('3. Gated Playback Token Authorization & Attendance Lock', () => {
    let readyPlaybackId: string;

    beforeAll(async () => {
      readyPlaybackId = `mux_pb_ready_${Date.now()}`;

      // Attach ready Mux asset to free lesson
      const freeAsset = await prisma.videoAsset.create({
        data: {
          provider: 'MUX',
          providerVideoId: `asset_free_${Date.now()}`,
          playbackId: readyPlaybackId,
          durationSeconds: 1800,
          title: 'Free Ready Video',
          status: VideoAssetStatus.READY,
          isPrivate: true
        }
      });
      await prisma.lesson.update({
        where: { id: freeLessonId },
        data: { videoId: freeAsset.id }
      });

      // Attach ready Mux asset to attendance locked lesson
      const lockedAsset = await prisma.videoAsset.create({
        data: {
          provider: 'MUX',
          providerVideoId: `asset_locked_${Date.now()}`,
          playbackId: `mux_pb_locked_${Date.now()}`,
          durationSeconds: 2400,
          title: 'Locked Attendance Video',
          status: VideoAssetStatus.READY,
          isPrivate: true
        }
      });
      await prisma.lesson.update({
        where: { id: attendanceLockedLessonId },
        data: { videoId: lockedAsset.id }
      });
    });

    it('Student cannot request playback token for a nonexistent lesson (404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${crypto.randomUUID()}/video/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(404);
    });

    it('Student cannot request playback token for an unauthorized lesson (403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${paidLessonId}/video/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().data).toBeUndefined();
    });

    it('Attendance-locked lesson cannot issue playback token (403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${attendanceLockedLessonId}/video/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().data).toBeUndefined();
    });

    it('Authorized student receives a signed playback token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${freeLessonId}/video/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json().data;
      expect(body.playbackId).toBe(readyPlaybackId);
      expect(body.token).toBeDefined();
      expect(body.expiresAt).toBeDefined();
      expect(body.playbackUrl).toContain(readyPlaybackId);
      expect(body.playbackUrl).toContain(body.token);

      // Security check: No secret keys or credentials returned
      expect(body.keySecret).toBeUndefined();
      expect(body.signingKey).toBeUndefined();
      expect(body.tokenSecret).toBeUndefined();
    });

    it('Playback token contains correct playback ID and RS256 algorithm', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${freeLessonId}/video/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      const body = res.json().data;
      const decodedHeader = jwt.decode(body.token, { complete: true });
      expect(decodedHeader).toBeDefined();
      expect(decodedHeader?.header.alg).toBe('RS256');

      const payload = decodedHeader?.payload as jwt.JwtPayload;
      expect(payload.kid).toBe(testKeyId);
      expect(payload.sub).toBe(readyPlaybackId);
      expect(payload.aud).toBe('v'); // Mux video audience claim
    });

    it('Playback token has sensible short-lived expiration (1 to 4 hours)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${freeLessonId}/video/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      const body = res.json().data;
      const decoded = jwt.decode(body.token) as jwt.JwtPayload;
      const nowSeconds = Math.floor(Date.now() / 1000);

      expect(decoded.exp).toBeDefined();
      const ttlSeconds = (decoded.exp || 0) - nowSeconds;

      // Minimum 1 hour (3600s), capped at 4 hours (14400s)
      expect(ttlSeconds).toBeGreaterThanOrEqual(3500);
      expect(ttlSeconds).toBeLessThanOrEqual(14500);
    });
  });

  describe('4. Safe Video Replacement and Removal', () => {
    let lessonWithOldVideoId: string;
    let oldAssetId: string;
    let oldPlaybackId: string;

    beforeAll(async () => {
      const generatedPlaybackId = `mux_pb_old_${Date.now()}`;
      const oldAsset = await prisma.videoAsset.create({
        data: {
          provider: 'MUX',
          providerVideoId: `asset_old_${Date.now()}`,
          playbackId: generatedPlaybackId,
          durationSeconds: 1200,
          title: 'Original Working Video',
          status: VideoAssetStatus.READY,
          isPrivate: true
        }
      });
      oldAssetId = oldAsset.id;
      oldPlaybackId = generatedPlaybackId;

      const lesson = await prisma.lesson.create({
        data: {
          curriculumId: testCourseId,
          title: 'Replace Test Lesson',
          content: 'Test lesson content for safe video replacement',
          isFree: true,
          accessType: LessonAccessType.FREE,
          videoId: oldAssetId
        }
      });
      lessonWithOldVideoId = lesson.id;
    });

    it('Replacing a video does not immediately destroy the working old video', async () => {
      // Admin initiates replacement upload
      const uploadRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/lessons/${lessonWithOldVideoId}/video/upload-url`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(uploadRes.statusCode).toBe(201);
      const newUploadData = uploadRes.json().data;

      // Invariant: While new video is PENDING/PROCESSING, old video MUST remain attached!
      const lessonWhileUploading = await prisma.lesson.findUnique({
        where: { id: lessonWithOldVideoId }
      });
      expect(lessonWhileUploading?.videoId).toBe(oldAssetId);

      // Student playback STILL serves old working video
      const playbackRes = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonWithOldVideoId}/video/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });
      expect(playbackRes.statusCode).toBe(200);
      expect(playbackRes.json().data.playbackId).toBe(oldPlaybackId);

      // Webhook fires video.asset.ready for new video
      const newPlaybackId = `mux_pb_new_${Date.now()}`;
      const payload = JSON.stringify({
        type: 'video.asset.ready',
        data: {
          id: `mux_asset_new_${Date.now()}`,
          upload_id: newUploadData.providerVideoId,
          duration: 1500,
          status: 'ready',
          playback_ids: [{ id: newPlaybackId, policy: 'signed' }]
        }
      });

      const sig = generateMuxSignatureHeader(payload);
      await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/mux',
        headers: { 'Content-Type': 'application/json', 'mux-signature': sig },
        payload
      });

      // Now the lesson is safely swapped to the new ready video!
      const lessonAfterReady = await prisma.lesson.findUnique({
        where: { id: lessonWithOldVideoId }
      });
      expect(lessonAfterReady?.videoId).toBe(newUploadData.videoAssetId);

      // Audit log records VIDEO_REPLACED
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: lessonWithOldVideoId, action: 'VIDEO_REPLACED' }
      });
      expect(audit).toBeDefined();
    });

    it('Removing a video removes playback access', async () => {
      const removeRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/lessons/${lessonWithOldVideoId}/video`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(removeRes.statusCode).toBe(200);

      // Verification: lesson has no video
      const lesson = await prisma.lesson.findUnique({ where: { id: lessonWithOldVideoId } });
      expect(lesson?.videoId).toBeNull();

      // Playback returns null
      const playbackRes = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonWithOldVideoId}/video/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });
      expect(playbackRes.statusCode).toBe(200);
      expect(playbackRes.json().data.playbackUrl).toBeNull();
    });
  });
});
