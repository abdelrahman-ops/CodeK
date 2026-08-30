import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import {
  createParentUserSchema,
  createStudentUserSchema,
  listUsersQuerySchema,
  updateUserSchema
} from './user.schema.js';
import * as userService from './user.service.js';
import { z } from 'zod';

export async function userRoutes(app: FastifyInstance) {
  // Admin create student
  app.post(
    '/students',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createStudentUserSchema.parse(request.body);
      const result = await userService.createStudentUser(input, request.user!.userId);
      return reply.status(201).send({ data: result });
    }
  );

  // Admin create parent
  app.post(
    '/parents',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createParentUserSchema.parse(request.body);
      const result = await userService.createParentUser(input, request.user!.userId);
      return reply.status(201).send({ data: result });
    }
  );

  // Admin generate one-time reset link (for WhatsApp)
  app.post(
    '/:id/generate-reset-link',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await userService.generateOneTimeResetLink(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Admin generate one-time invite link (for WhatsApp)
  app.post(
    '/:id/generate-invite-link',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await userService.generateOneTimeInviteLink(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Admin list users
  app.get(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const query = listUsersQuerySchema.parse(request.query);
      const result = await userService.listUsers(query);
      return reply.send({
        data: result.items,
        meta: result.meta
      });
    }
  );

  // Get user by id
  app.get(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const user = await userService.getUserById(id);
      return reply.send({ data: user });
    }
  );

  // Update user
  app.patch(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = updateUserSchema.parse(request.body);
      const updated = await userService.updateUser(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Delete user (Admin)
  app.delete(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await userService.deleteUser(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );
}
