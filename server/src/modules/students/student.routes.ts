import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import {
  listStudentsQuerySchema,
  updateStudentSchema,
  resetStudentPasswordSchema,
  bulkStudentStatusSchema,
  bulkAssignGroupSchema,
  bulkDeleteStudentsSchema
} from './student.schema.js';
import * as studentService from './student.service.js';
import { z } from 'zod';

export async function studentRoutes(app: FastifyInstance) {
  // List students (Admin only)
  app.get(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const query = listStudentsQuerySchema.parse(request.query);
      const result = await studentService.listStudents(query);
      return reply.send({
        data: result.items,
        meta: result.meta
      });
    }
  );

  // Bulk update student active status (Admin only)
  app.patch(
    '/bulk-status',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkStudentStatusSchema.parse(request.body || {});
      const result = await studentService.bulkUpdateStudentStatus(input.studentIds, input.isActive, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Bulk assign group to students (Admin only)
  app.post(
    '/bulk-assign-group',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkAssignGroupSchema.parse(request.body || {});
      const result = await studentService.bulkAssignGroup(input.studentIds, input.groupId, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Bulk delete students (Admin only — safe checks: protects students with historical records)
  app.delete(
    '/bulk',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkDeleteStudentsSchema.parse(request.body || {});
      const result = await studentService.bulkDeleteStudents(input.studentIds, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Get student profile (Admin, Self, or Linked Parent)
  app.get(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const student = await studentService.getStudentById(id, request.user!);
      return reply.send({ data: student });
    }
  );

  // Get student progress metrics
  app.get(
    '/:id/progress',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const progress = await studentService.getStudentProgress(id, request.user!);
      return reply.send({ data: progress });
    }
  );

  // Update student profile (Admin)
  app.patch(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = updateStudentSchema.parse(request.body);
      const updated = await studentService.updateStudent(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Reset/Change student password (Admin only)
  app.post(
    '/:id/reset-password',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = resetStudentPasswordSchema.parse(request.body || {});
      const result = await studentService.resetStudentPassword(id, input, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Delete student (Admin)
  app.delete(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await studentService.deleteStudent(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );
}
