import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin, requireStudent } from '../../common/middleware/rbac.js';
import {
  createLessonSchema,
  linkLessonToSessionSchema,
  listLessonsQuerySchema,
  reorderLessonsSchema,
  updateLessonSchema,
  bulkPublishLessonsSchema,
  bulkDeleteLessonsSchema
} from './lesson.schema.js';
import { updateLessonProgressSchema } from './progress.schema.js';
import * as lessonService from './lesson.service.js';
import * as progressService from './progress.service.js';
import * as videoService from '../videos/video.service.js';
import { z } from 'zod';
import { ForbiddenError } from '../../common/errors/app-error.js';

export async function lessonRoutes(app: FastifyInstance) {
  // Create lesson (Admin)
  app.post(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createLessonSchema.parse(request.body);
      const lesson = await lessonService.createLesson(input, request.user!.userId);
      return reply.status(201).send({ data: lesson });
    }
  );

  // Bulk publish/unpublish lessons (Admin)
  app.patch(
    '/bulk-publish',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkPublishLessonsSchema.parse(request.body || {});
      const result = await lessonService.bulkPublishLessons(input.ids, input.isPublished, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Bulk delete lessons (Admin — safe checks: protects official curriculum and lessons with tasks)
  app.delete(
    '/bulk',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkDeleteLessonsSchema.parse(request.body || {});
      const result = await lessonService.bulkDeleteLessons(input.ids, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Reorder lessons (Admin)
  app.post(
    '/reorder',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = reorderLessonsSchema.parse(request.body);
      const result = await lessonService.reorderLessons(input, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // List lessons (with unlock state annotated for student)
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = listLessonsQuerySchema.parse(request.query);
      const lessons = await lessonService.listLessons(query, request.user!);
      return reply.send({ data: lessons });
    }
  );

  // Get lesson details (Strict attendance-based content unlocking)
  app.get(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const lesson = await lessonService.getLessonById(id, request.user!);
      return reply.send({ data: lesson });
    }
  );

  // Get gated lesson video playback information (Strictly enforces canAccessLesson)
  app.get(
    '/:id/playback',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const playback = await videoService.getLessonPlaybackInfo(id, request.user!);
      return reply.send({ data: playback });
    }
  );

  // Canonical Mux signed playback alias
  app.get(
    '/:id/video/playback',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const playback = await videoService.getLessonPlaybackInfo(id, request.user!);
      return reply.send({ data: playback });
    }
  );

  // Request direct upload URL for lesson (Admin only)
  app.post(
    '/:id/video/upload-url',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const session = await videoService.createDirectUploadSession(
        { lessonId: id, isPrivate: true },
        request.user!.userId
      );
      return reply.status(201).send({ data: session });
    }
  );

  // Get lesson video status (Admin only)
  app.get(
    '/:id/video',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const status = await videoService.getLessonVideoStatus(id);
      return reply.send({ data: status });
    }
  );

  // Remove lesson video safely (Admin only)
  app.delete(
    '/:id/video',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await videoService.removeLessonVideo(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Get student lesson progress
  app.get(
    '/:id/progress',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const studentId = request.user!.studentId;
      if (!studentId) {
        throw new ForbiddenError('Only students have individual lesson progress tracking');
      }
      const progress = await progressService.getStudentLessonProgress(studentId, id);
      return reply.send({ data: progress });
    }
  );

  // Update student lesson progress
  app.post(
    '/:id/progress',
    { preHandler: [authenticate, requireStudent] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const studentId = request.user!.studentId!;
      const input = updateLessonProgressSchema.parse(request.body || {});
      const updated = await progressService.updateStudentLessonProgress(studentId, id, input);
      return reply.send({ data: updated });
    }
  );

  // Link lesson to session (Admin)
  app.post(
    '/:id/link-session',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = linkLessonToSessionSchema.parse(request.body);
      const link = await lessonService.linkLessonToSession(id, input, request.user!.userId);
      return reply.status(201).send({ data: link });
    }
  );

  // Update lesson (Admin)
  app.patch(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = updateLessonSchema.parse(request.body);
      const updated = await lessonService.updateLesson(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Delete lesson (Admin)
  app.delete(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await lessonService.deleteLesson(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );
}
