import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import { z } from 'zod';
import {
  createAccessGrantSchema,
  revokeAccessGrantSchema,
  listAccessGrantsQuerySchema,
  createSubscriptionPlanSchema
} from './access.schema.js';
import * as accessService from './access.service.js';

export async function accessRoutes(app: FastifyInstance) {
  // Check access to a lesson (Authoritative endpoint for caller)
  app.get(
    '/lessons/:id/access',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const studentId = request.user?.studentId || null;

      const decision = await accessService.getLessonAccess(studentId, id, {
        userId: request.user?.userId,
        role: request.user?.role
      });

      return reply.send({ data: decision });
    }
  );

  // Grant educational access (Admin)
  app.post(
    '/grants',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createAccessGrantSchema.parse(request.body);
      const grant = await accessService.grantEducationalAccess(input, request.user!.userId);
      return reply.status(201).send({ data: grant });
    }
  );

  // List educational access grants (Admin)
  app.get(
    '/grants',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const query = listAccessGrantsQuerySchema.parse(request.query);
      const grants = await accessService.listAccessGrants(query);
      return reply.send({ data: grants });
    }
  );

  // Revoke educational access grant (Admin)
  app.post(
    '/grants/:id/revoke',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = revokeAccessGrantSchema.parse(request.body);
      const updated = await accessService.revokeEducationalAccess(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // List Subscription Plans (Public / Authenticated)
  app.get('/plans', async (request, reply) => {
    const plans = await accessService.listSubscriptionPlans(true);
    return reply.send({ data: plans });
  });

  // Create Subscription Plan (Admin)
  app.post(
    '/plans',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createSubscriptionPlanSchema.parse(request.body);
      const plan = await accessService.createSubscriptionPlan(input, request.user!.userId);
      return reply.status(201).send({ data: plan });
    }
  );
}
