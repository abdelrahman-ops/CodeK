import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import { listStudentsQuerySchema, updateStudentSchema, resetStudentPasswordSchema } from './student.schema.js';
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
