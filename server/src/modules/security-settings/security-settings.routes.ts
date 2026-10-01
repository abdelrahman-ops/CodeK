import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import { getSecuritySettings, updateSecuritySettings } from './security-settings.service.js';

const updateSecuritySettingsSchema = z.object({
  watermarkEnabled: z.boolean().optional(),
  antiScreenshotEnabled: z.boolean().optional(),
  watermarkOpacity: z.number().min(5).max(100).optional()
});

export async function securitySettingsRoutes(app: FastifyInstance) {
  // Get Security Settings (Authenticated users / Students / Admin)
  app.get(
    '/security',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      const settings = await getSecuritySettings();
      return reply.send({ data: settings });
    }
  );

  // Update Security Settings (Admin Only)
  app.patch(
    '/admin/security',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = updateSecuritySettingsSchema.parse(request.body || {});
      const updated = await updateSecuritySettings(input, request.user?.userId);
      return reply.send({ data: updated });
    }
  );
}
