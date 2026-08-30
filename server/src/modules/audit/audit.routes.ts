import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import { listAuditLogsQuerySchema } from './audit.schema.js';
import * as auditService from './audit.service.js';

export async function auditRoutes(app: FastifyInstance) {
  app.get(
    '/',
    {
      preHandler: [authenticate, requireAdmin]
    },
    async (request, reply) => {
      const query = listAuditLogsQuerySchema.parse(request.query);
      const result = await auditService.listAuditLogs(query);
      return reply.send({
        data: result.items,
        meta: result.meta
      });
    }
  );
}
