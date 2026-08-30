import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin, requireParent, requireStudent } from '../../common/middleware/rbac.js';
import * as dashboardService from './dashboard.service.js';

export async function dashboardRoutes(app: FastifyInstance) {
  // Student Dashboard
  app.get(
    '/student',
    { preHandler: [authenticate, requireStudent] },
    async (request, reply) => {
      const dashboard = await dashboardService.getStudentDashboard(request.user!.userId);
      return reply.send({ data: dashboard });
    }
  );

  // Parent Dashboard
  app.get(
    '/parent',
    { preHandler: [authenticate, requireParent] },
    async (request, reply) => {
      const dashboard = await dashboardService.getParentDashboard(request.user!.userId);
      return reply.send({ data: dashboard });
    }
  );

  // Admin Dashboard
  app.get(
    '/admin',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const dashboard = await dashboardService.getAdminDashboard();
      return reply.send({ data: dashboard });
    }
  );
}
