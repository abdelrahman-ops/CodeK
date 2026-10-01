import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import {
  createGroupSchema,
  enrollStudentSchema,
  listGroupsQuerySchema,
  updateGroupSchema,
  bulkDeleteGroupsSchema
} from './group.schema.js';
import * as groupService from './group.service.js';
import { z } from 'zod';

export async function groupRoutes(app: FastifyInstance) {
  // Create group (Admin)
  app.post(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createGroupSchema.parse(request.body);
      const group = await groupService.createGroup(input, request.user!.userId);
      return reply.status(201).send({ data: group });
    }
  );

  // List groups (Admin or Authenticated user)
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = listGroupsQuerySchema.parse(request.query);
      const groups = await groupService.listGroups(query);
      return reply.send({ data: groups });
    }
  );

  // Get group by id (Admin gets full data, Student gets peer classmate view)
  app.get(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const group = await groupService.getGroupById(id, request.user!);
      return reply.send({ data: group });
    }
  );

  // Update group (Admin)
  app.patch(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = updateGroupSchema.parse(request.body);
      const updated = await groupService.updateGroup(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Enroll student into group (Admin)
  app.post(
    '/:id/enroll',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = enrollStudentSchema.parse(request.body);
      const enrollment = await groupService.enrollStudentInGroup(id, input.studentId, request.user!.userId);
      return reply.status(201).send({ data: enrollment });
    }
  );

  // Remove student from group (Admin)
  app.delete(
    '/:id/enrollments/:studentId',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id, studentId } = z.object({
        id: z.string().uuid(),
        studentId: z.string().uuid()
      }).parse(request.params);
      const result = await groupService.removeStudentFromGroup(id, studentId, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Bulk delete groups (Admin)
  app.delete(
    '/bulk',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { ids } = bulkDeleteGroupsSchema.parse(request.body);
      const result = await groupService.deleteGroupsBulk(ids, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Delete group (Admin)
  app.delete(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await groupService.deleteGroup(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );
}

