import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import {
  assignTaskSchema,
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
  bulkPublishTasksSchema,
  bulkDeleteTasksSchema
} from './task.schema.js';
import * as taskService from './task.service.js';
import { z } from 'zod';

export async function taskRoutes(app: FastifyInstance) {
  // Create task (Admin)
  app.post(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createTaskSchema.parse(request.body);
      const task = await taskService.createTask(input, request.user!.userId);
      return reply.status(201).send({ data: task });
    }
  );

  // Bulk publish/unpublish tasks (Admin)
  app.patch(
    '/bulk-publish',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkPublishTasksSchema.parse(request.body || {});
      const result = await taskService.bulkPublishTasks(input.ids, input.isPublished, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Bulk delete tasks (Admin — safe checks: prevents deleting tasks with student submissions)
  app.delete(
    '/bulk',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = bulkDeleteTasksSchema.parse(request.body || {});
      const result = await taskService.bulkDeleteTasks(input.ids, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Assign task to group (Admin)
  app.post(
    '/:id/assign',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = assignTaskSchema.parse(request.body);
      const assignment = await taskService.assignTaskToGroup(id, input, request.user!.userId);
      return reply.status(201).send({ data: assignment });
    }
  );

  // List tasks (Admin or Group-filtered for student)
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = listTasksQuerySchema.parse(request.query);
      const tasks = await taskService.listTasks(query, request.user!);
      return reply.send({ data: tasks });
    }
  );

  // Get task by id
  app.get(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const task = await taskService.getTaskById(id, request.user!);
      return reply.send({ data: task });
    }
  );

  // Update task (Admin)
  app.patch(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = updateTaskSchema.parse(request.body);
      const updated = await taskService.updateTask(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Delete task (Admin)
  app.delete(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await taskService.deleteTask(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );
}
