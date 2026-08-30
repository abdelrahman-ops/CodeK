import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin, requireStudent } from '../../common/middleware/rbac.js';
import {
  createSubmissionSchema,
  listSubmissionsQuerySchema,
  reviewSubmissionSchema
} from './submission.schema.js';
import * as submissionService from './submission.service.js';
import { z } from 'zod';

export async function submissionRoutes(app: FastifyInstance) {
  // Student submit task
  app.post(
    '/',
    { preHandler: [authenticate, requireStudent] },
    async (request, reply) => {
      const input = createSubmissionSchema.parse(request.body);
      const submission = await submissionService.submitTask(request.user!.userId, input);
      return reply.status(201).send({ data: submission });
    }
  );

  // Admin list submissions
  app.get(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const query = listSubmissionsQuerySchema.parse(request.query);
      const result = await submissionService.listSubmissions(query);
      return reply.send({
        data: result.items,
        meta: result.meta
      });
    }
  );

  // Admin review submission
  app.patch(
    '/:id/review',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = reviewSubmissionSchema.parse(request.body);
      const updated = await submissionService.reviewSubmission(id, input, request.user!.userId);
      return reply.send({ data: updated });
    }
  );
}
