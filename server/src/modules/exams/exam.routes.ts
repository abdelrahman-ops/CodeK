import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin, requireStudent } from '../../common/middleware/rbac.js';
import {
  createExamQuestionSchema,
  createExamSchema,
  listExamsQuerySchema,
  submitExamAttemptSchema,
  updateExamSchema,
  bulkPublishExamsSchema,
  bulkDeleteExamsSchema
} from './exam.schema.js';
import * as examService from './exam.service.js';
import { z } from 'zod';

export async function examRoutes(app: FastifyInstance) {
  // Create exam (Admin)
  app.post(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createExamSchema.parse(request.body);
      const exam = await examService.createExam(input, request.user!.userId);
      return reply.status(201).send({ data: exam });
    }
  );

  // Bulk publish/unpublish exams (Admin)
  app.patch(
    '/bulk-publish',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkPublishExamsSchema.parse(request.body || {});
      const result = await examService.bulkPublishExams(input.ids, input.isPublished, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Bulk delete exams (Admin — safe checks: prevents deleting exams with student attempts)
  app.delete(
    '/bulk',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkDeleteExamsSchema.parse(request.body || {});
      const result = await examService.bulkDeleteExams(input.ids, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Add question to exam (Admin)
  app.post(
    '/:id/questions',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = createExamQuestionSchema.parse(request.body);
      const question = await examService.addExamQuestion(id, input, request.user!.userId);
      return reply.status(201).send({ data: question });
    }
  );

  // List exams
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = listExamsQuerySchema.parse(request.query);
      const exams = await examService.listExams(query, request.user!);
      return reply.send({ data: exams });
    }
  );

  // Get exam details for taking or reviewing
  app.get(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const exam = await examService.getExamForStudent(id, request.user!);
      return reply.send({ data: exam });
    }
  );

  // Submit exam attempt (Student)
  app.post(
    '/:id/submit',
    { preHandler: [authenticate, requireStudent] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = submitExamAttemptSchema.parse(request.body);
      const result = await examService.submitExamAttempt(request.user!.userId, id, input);
      return reply.send({ data: result });
    }
  );

  // Update exam (Admin)
  app.patch(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = updateExamSchema.parse(request.body);
      const updated = await examService.updateExam(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Delete exam (Admin)
  app.delete(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await examService.deleteExam(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Delete question from exam (Admin)
  app.delete(
    '/:id/questions/:questionId',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id, questionId } = z.object({
        id: z.string().uuid(),
        questionId: z.string().uuid()
      }).parse(request.params);
      const result = await examService.deleteExamQuestion(id, questionId, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Get exam attempts & results (Admin)
  app.get(
    '/:id/attempts',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await examService.getExamAttempts(id);
      return reply.send({ data: result });
    }
  );
}
