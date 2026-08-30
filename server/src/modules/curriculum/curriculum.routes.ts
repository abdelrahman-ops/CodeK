import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import {
  createCurriculumSchema,
  listCurriculumQuerySchema,
  updateCurriculumSchema
} from './curriculum.schema.js';
import * as curriculumService from './curriculum.service.js';
import { z } from 'zod';

export async function curriculumRoutes(app: FastifyInstance) {
  // Create curriculum (Admin)
  app.post(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createCurriculumSchema.parse(request.body);
      const curriculum = await curriculumService.createCurriculum(input, request.user!.userId);
      return reply.status(201).send({ data: curriculum });
    }
  );

  // List curricula (All authenticated users)
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = listCurriculumQuerySchema.parse(request.query);
      const items = await curriculumService.listCurricula(query);
      return reply.send({ data: items });
    }
  );

  // Get curriculum by id
  app.get(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const item = await curriculumService.getCurriculumById(id);
      return reply.send({ data: item });
    }
  );

  // Update curriculum (Admin)
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

  // Delete curriculum (Admin)
  app.delete(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await curriculumService.deleteCurriculum(id, request.user!.userId);
      return reply.send({ data: result });
    }
  );
}
