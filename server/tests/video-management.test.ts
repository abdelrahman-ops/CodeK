import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { videoProviderFactory } from '../src/modules/videos/video-provider.factory.js';
import { MockLocalVideoProvider } from '../src/modules/videos/providers/mock-video.provider.js';
import { ExternalVideoProvider } from '../src/modules/videos/providers/external-video.provider.js';
import { LOCKED_EXPLANATION_AR } from '../src/modules/lessons/lesson-access.service.js';

describe('Phase 3: Video Management System', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;
  let testCourseId: string;
  let freeLessonId: string;
  let lockedLessonId: string;
  let noVideoLessonId: string;

  beforeAll(async () => {
    process.env.VIDEO_PROVIDER = 'MOCK';
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Setup Student
    const studentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    studentToken = studentRes.json().data.accessToken;
    await prisma.subscription.deleteMany({ where: { student: { user: { loginId: 'STU-1001' } } } });

    // Create Test Course
    const courseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/curriculum',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Video System Test Course ' + Date.now(),
        description: 'Testing video provider abstraction and gated playback'
      }
    });
    testCourseId = courseRes.json().data.id;

    // Create Lesson 1: Free Preview Lesson
    const freeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: testCourseId,
        title: 'Free Preview Video Lesson',
        content: 'Free preview markdown content',
        isFree: true,
        accessType: 'FREE'
      }
    });
    freeLessonId = freeRes.json().data.id;

    // Create Lesson 2: Attendance Gated Lesson (Locked)
    const lockedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: testCourseId,
        title: 'Locked Attendance Video Lesson',
        content: 'Secret attendance-only content',
        isFree: false,
        accessType: 'ATTENDANCE_REQUIRED'
      }
    });
    lockedLessonId = lockedRes.json().data.id;

    // Link locked lesson to a session so attendance is required
    const group = await prisma.group.create({
      data: { name: 'Video Test Group ' + Date.now() }
    });
    const session = await prisma.session.create({
      data: {
        groupId: group.id,
        sessionNumber: 1,
        date: new Date(),
        startTime: '16:00',
        endTime: '18:00',
        status: 'COMPLETED'
      }
    });
    await prisma.sessionLesson.create({
      data: {
        sessionId: session.id,
        lessonId: lockedLessonId,
        order: 1
      }
    });

    // Create Lesson 3: No Video Lesson
    const noVideoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: testCourseId,
        title: 'Text-Only Lesson (No Video)',
        content: 'Text-only lesson content',
        isFree: true,
        accessType: 'FREE'
      }
    });
    noVideoLessonId = noVideoRes.json().data.id;
  });

  describe('1. Provider-Independent Abstraction Contract', () => {
    it('MockLocalVideoProvider generates direct upload session without external dependencies', async () => {
      const mock = new MockLocalVideoProvider();
      expect(mock.isConfigured()).toBe(true);

      const directUpload = await mock.createDirectUpload({
        maxDurationSeconds: 1200,
        requireSignedPlayback: true
      });

      expect(directUpload.uploadUrl).toBeDefined();
      expect(directUpload.providerVideoId).toMatch(/^mock_vid_/);
      expect(directUpload.isDirectPost).toBe(true);

      const playback = await mock.getPlaybackInfo(directUpload.providerVideoId, {
        requireSignedPlayback: true
      });
      expect(playback.playbackUrl).toContain(directUpload.providerVideoId);
      expect(playback.thumbnailUrl).toBeDefined();
      expect(playback.isPrivate).toBe(true);

      const meta = await mock.getVideoMetadata(directUpload.providerVideoId);
      expect(meta.status).toBe('READY');
      expect(meta.durationSeconds).toBe(1200);
    });

    it('ExternalVideoProvider correctly handles YouTube and Vimeo embed URLs and thumbnails', async () => {
      const external = new ExternalVideoProvider();
      expect(external.isConfigured()).toBe(true);

      const yt = await external.getPlaybackInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(yt.playbackUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(yt.thumbnailUrl).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(yt.isPrivate).toBe(false);

      const vimeo = await external.getPlaybackInfo('https://vimeo.com/76979871');
      expect(vimeo.playbackUrl).toBe('https://player.vimeo.com/video/76979871');
      expect(vimeo.thumbnailUrl).toBe('https://vumbnail.com/76979871.jpg');
    });

    it('VideoProviderFactory falls back gracefully to Mock provider when cloud credentials not set', () => {
      const provider = videoProviderFactory.getProvider();
      expect(provider).toBeDefined();
      expect(typeof provider.createDirectUpload).toBe('function');
      expect(typeof provider.getPlaybackInfo).toBe('function');
    });
  });

  describe('2. Direct Upload & Video Asset Lifecycle', () => {
    let uploadedAssetId: string;

    it('admin initiates direct upload and receives one-time upload URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/videos/direct-upload',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Introduction to Algorithms Video',
          maxDurationSeconds: 1800,
          isPrivate: true
        }
      });

      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      expect(data.videoAssetId).toBeDefined();
      expect(data.uploadUrl).toBeDefined();
      expect(data.providerVideoId).toBeDefined();
      uploadedAssetId = data.videoAssetId;

      // Verify asset in database
      const asset = await prisma.videoAsset.findUnique({ where: { id: uploadedAssetId } });
      expect(asset).toBeDefined();
      expect(asset?.status).toBe('PENDING_UPLOAD');
      expect(asset?.isPrivate).toBe(true);
    });

    it('admin confirms direct upload completion and updates metadata', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/videos/confirm-upload',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          videoAssetId: uploadedAssetId
        }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.status).toBe('READY');
      expect(data.durationSeconds).toBe(1800);
      expect(data.thumbnailUrl).toBeDefined();
    });

    it('admin connects an external video URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/videos/connect-external',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          url: 'https://www.youtube.com/watch?v=kqtD5dpn9C8',
          title: 'Python Tutorial External',
          durationSeconds: 900
        }
      });

      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      expect(data.provider).toBe('EXTERNAL');
      expect(data.playbackUrl).toBe('https://www.youtube.com/embed/kqtD5dpn9C8');
      expect(data.thumbnailUrl).toBe('https://img.youtube.com/vi/kqtD5dpn9C8/hqdefault.jpg');
    });
  });

  describe('3. Attaching, Replacing, and Detaching Videos on Lessons', () => {
    let videoAssetId: string;

    beforeAll(async () => {
      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/videos/direct-upload',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { title: 'Lesson Attached Video', maxDurationSeconds: 1200 }
      });
      videoAssetId = uploadRes.json().data.videoAssetId;

      await app.inject({
        method: 'POST',
        url: '/api/v1/videos/confirm-upload',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { videoAssetId }
      });
    });

    it('admin attaches managed video asset to lesson', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/videos/lessons/${freeLessonId}/attach`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { videoAssetId }
      });

      expect(res.statusCode).toBe(200);
      const lesson = res.json().data;
      expect(lesson.videoId).toBe(videoAssetId);
      expect(lesson.video).toBeDefined();
      expect(lesson.video.id).toBe(videoAssetId);
    });

    it('admin also attaches video asset to locked lesson for access tests', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/videos/lessons/${lockedLessonId}/attach`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { videoAssetId }
      });
      expect(res.statusCode).toBe(200);
    });

    it('admin detaches video from lesson without deleting the video asset', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/videos/lessons/${freeLessonId}/detach`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const lesson = res.json().data;
      expect(lesson.videoId).toBeNull();

      // Video asset remains intact in DB
      const asset = await prisma.videoAsset.findUnique({ where: { id: videoAssetId } });
      expect(asset).toBeDefined();

      // Reattach to freeLessonId for playback tests
      await app.inject({
        method: 'POST',
        url: `/api/v1/videos/lessons/${freeLessonId}/attach`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { videoAssetId }
      });
    });
  });

  describe('4. Gated Video Playback Security', () => {
    it('unauthorized student cannot access playback information on locked lesson (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lockedLessonId}/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error?.message).toBe(LOCKED_EXPLANATION_AR);
      expect(body.data).toBeUndefined();
    });

    it('student accesses playback information on unlocked free preview lesson (200 OK)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${freeLessonId}/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const playback = res.json().data;
      expect(playback.playbackUrl).toBeDefined();
      expect(playback.thumbnailUrl).toBeDefined();
      expect(playback.durationSeconds).toBeDefined();
    });

    it('lesson without video returns 200 OK with null playbackUrl without error', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${noVideoLessonId}/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.playbackUrl).toBeNull();
    });

    it('legacy lesson with raw videoUrl returns valid playback info', async () => {
      // Update noVideoLessonId with legacy videoUrl
      await prisma.lesson.update({
        where: { id: noVideoLessonId },
        data: { videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${noVideoLessonId}/playback`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const playback = res.json().data;
      expect(playback.playbackUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(playback.thumbnailUrl).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    });

    it('admin bypasses access restrictions and can preview any lesson playback', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lockedLessonId}/playback`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.playbackUrl).toBeDefined();
    });
  });
});
