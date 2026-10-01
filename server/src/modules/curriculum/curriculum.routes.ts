import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import {
  createCurriculumSchema,
  listCurriculumQuerySchema,
  updateCurriculumSchema,
  bulkDeleteCurriculaSchema
} from './curriculum.schema.js';
import {
  createSectionSchema,
  reorderSectionsSchema,
  updateSectionSchema,
  bulkPublishSectionsSchema,
  bulkDeleteSectionsSchema
} from './section.schema.js';
import * as curriculumService from './curriculum.service.js';
import * as sectionService from './section.service.js';
import * as progressService from '../lessons/progress.service.js';
import { z } from 'zod';
import { ForbiddenError } from '../../common/errors/app-error.js';
import { Role } from '@prisma/client';

export async function curriculumRoutes(app: FastifyInstance) {
  // Create curriculum / course (Admin)
  app.post(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createCurriculumSchema.parse(request.body);
      const curriculum = await curriculumService.createCurriculum(input, request.user!.userId);
      return reply.status(201).send({ data: curriculum });
    }
  );

  // List curricula / courses (All authenticated users)
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = listCurriculumQuerySchema.parse(request.query);
      const items = await curriculumService.listCurricula(query, request.user);
      return reply.send({ data: items });
    }
  );

  // Student courses summary with progress and continue lesson
  app.get(
    '/student/summary',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const studentId = request.user?.studentId;
      if (!studentId) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Student profile required' } });
      }
      const summary = await curriculumService.getStudentCoursesSummary(studentId);
      return reply.send({ data: summary });
    }
  );

  // Get curriculum / course by id (includes sections and lessons)
  app.get(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const item = await curriculumService.getCurriculumById(id, request.user);
      return reply.send({ data: item });
    }
  );

  // Update curriculum / course (Admin)
  app.patch(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = updateCurriculumSchema.parse(request.body);
      const updated = await curriculumService.updateCurriculum(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Bulk delete curricula / courses (Admin)
  app.delete(
    '/bulk',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { ids } = bulkDeleteCurriculaSchema.parse(request.body);
      const result = await curriculumService.deleteCurriculaBulk(ids, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Delete curriculum / course (Admin)
  app.delete(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await curriculumService.deleteCurriculum(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );


  // ----------------------------------------------------
  // SECTION MANAGEMENT ENDPOINTS
  // ----------------------------------------------------

  // Create section under curriculum (Admin)
  app.post(
    '/:id/sections',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = createSectionSchema.parse(request.body);
      const section = await sectionService.createSection(id, input, request.user!.userId);
      return reply.status(201).send({ data: section });
    }
  );

  // List sections for curriculum
  app.get(
    '/:id/sections',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const sections = await sectionService.listSections(id, request.user);
      return reply.send({ data: sections });
    }
  );

  // Bulk publish/unpublish sections (Admin)
  app.patch(
    '/sections/bulk-publish',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkPublishSectionsSchema.parse(request.body || {});
      const result = await sectionService.bulkPublishSections(input.ids, input.isPublished, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Bulk delete sections (Admin — safe checks: protects official curriculum sections)
  app.delete(
    '/sections/bulk',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkDeleteSectionsSchema.parse(request.body || {});
      const result = await sectionService.bulkDeleteSections(input.ids, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Update section (Admin)
  app.patch(
    '/sections/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = updateSectionSchema.parse(request.body);
      const updated = await sectionService.updateSection(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Delete section (Admin)
  app.delete(
    '/sections/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await sectionService.deleteSection(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Reorder sections (Admin)
  app.post(
    '/:id/sections/reorder',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = reorderSectionsSchema.parse(request.body);
      const updatedList = await sectionService.reorderSections(id, input, request.user!.userId);
      return reply.send({ data: updatedList });
    }
  );

  // ----------------------------------------------------
  // COURSE / CURRICULUM PROGRESS
  // ----------------------------------------------------

  // Get student's progress for a course/curriculum
  app.get(
    '/:id/progress',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const query = request.query as { studentId?: string };

      let targetStudentId = request.user!.studentId;
      if (request.user!.role === Role.ADMIN && query.studentId) {
        targetStudentId = query.studentId;
      }

      if (!targetStudentId) {
        throw new ForbiddenError('Student ID required to view progress');
      }

      const progress = await progressService.getCourseProgress(id, targetStudentId);
      return reply.send({ data: progress });
    }
  );
}
