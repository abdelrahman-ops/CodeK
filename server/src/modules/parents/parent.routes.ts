import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin, requireParent } from '../../common/middleware/rbac.js';
import { linkChildSchema, updateChildRelationshipSchema } from './parent.schema.js';
import * as parentService from './parent.service.js';
import { z } from 'zod';

export async function parentRoutes(app: FastifyInstance) {
  // Get linked children for authenticated parent
  app.get(
    '/my-children',
    { preHandler: [authenticate, requireParent] },
    async (request, reply) => {
      const children = await parentService.getMyChildren(request.user!.userId);
      return reply.send({ data: children });
    }
  );

  // Link child to parent (Admin only - creates or updates relationship safely)
  app.post(
    '/link-child',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = linkChildSchema.parse(request.body);
      const link = await parentService.linkChild(input, request.user!.userId);
      return reply.status(200).send({ data: link });
    }
  );

  // Update relationship type (Admin only)
  app.patch(
    '/update-relationship',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = updateChildRelationshipSchema.parse(request.body);
      const updated = await parentService.updateChildRelationship(input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );

  // Unlink child from parent (Admin only)
  app.delete(
    '/unlink-child',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const query = z.object({
        parentId: z.string().uuid(),
        studentId: z.string().uuid()
      }).parse(request.query);
      const result = await parentService.unlinkChild(query.parentId, query.studentId, request.user!.userId);
      return reply.send({ data: result });
    }
  );

  // Delete parent (Admin only)
  app.delete(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await parentService.deleteParent(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );
}
