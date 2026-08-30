import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import { createNotificationSchema, listNotificationsQuerySchema } from './notification.schema.js';
import * as notificationService from './notification.service.js';
import { z } from 'zod';

export async function notificationRoutes(app: FastifyInstance) {
  // Get current user's notifications
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = listNotificationsQuerySchema.parse(request.query);
      const result = await notificationService.listUserNotifications(request.user!.userId, query);
      return reply.send({
        data: result.items,
        meta: result.meta
      });
    }
  );

  // Mark single notification as read
  app.patch(
    '/:id/read',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const item = await notificationService.markAsRead(id, request.user!.userId);
      return reply.send({ data: item });
    }
  );

  // Mark all notifications as read
  app.post(
    '/read-all',
    { preHandler: [authenticate] },
    async (request, reply) => {
      await notificationService.markAllAsRead(request.user!.userId);
      return reply.send({ data: { success: true } });
    }
  );

  // Admin manually send notification
  app.post(
    '/',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createNotificationSchema.parse(request.body);
      const notification = await notificationService.createNotification(input);
      return reply.status(201).send({ data: notification });
    }
  );
}
