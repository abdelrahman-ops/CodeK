import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import {
  createLessonSchema,
  linkLessonToSessionSchema,
  listLessonsQuerySchema,
  updateLessonSchema
} from './lesson.schema.js';
import * as lessonService from './lesson.service.js';
import { z } from 'zod';

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
