import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import {
  createSessionSchema,
  listSessionsQuerySchema,
  updateSessionSchema
} from './session.schema.js';
import * as sessionService from './session.service.js';
import { z } from 'zod';

export async function sessionRoutes(app: FastifyInstance) {
  // Create session (Admin)
  app.post(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createSessionSchema.parse(request.body);
      const session = await sessionService.createSession(input, request.user!.userId);
      return reply.status(201).send({ data: session });
    }
  );

  // List sessions
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = listSessionsQuerySchema.parse(request.query);
      const result = await sessionService.listSessions(query);
      return reply.send({
        data: result.items,
        meta: result.meta
      });
    }
  );

  // Get session by id
  app.get(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const session = await sessionService.getSessionById(id);
      return reply.send({ data: session });
    }
  );

  // Start session & generate QR token (Admin)
  app.post(
    '/:id/start',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await sessionService.startSession(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Get active QR token status (Admin)
  app.get(
    '/:id/qr-token',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await sessionService.getSessionQrToken(id);
      return reply.send({ data: result });
    }
  );

  // Update session (Admin)
  app.patch(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = updateSessionSchema.parse(request.body);
      const updated = await sessionService.updateSession(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Delete session (Admin)
  app.delete(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await sessionService.deleteSession(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );
}
