import { FastifyInstance } from 'fastify';
import { authenticate } from '../../common/middleware/auth.js';
import { requireAdmin } from '../../common/middleware/rbac.js';
import {
  createDirectUploadSchema,
  confirmUploadSchema,
  connectExternalVideoSchema,
  attachVideoSchema
} from './video.schema.js';
import * as videoService from './video.service.js';
import { z } from 'zod';

export async function videoRoutes(app: FastifyInstance) {
  // Direct upload initialization (Admin only)
  app.post(
    '/direct-upload',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = createDirectUploadSchema.parse(request.body);
      const session = await videoService.createDirectUploadSession(input);
      return reply.status(201).send({ data: session });
    }
  );

  // Confirm direct upload completed (Admin only)
  app.post(
    '/confirm-upload',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = confirmUploadSchema.parse(request.body);
      const asset = await videoService.confirmUploadComplete(input);
      return reply.send({ data: asset });
    }
  );

  // Connect external video link (Admin only)
  app.post(
    '/connect-external',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const input = connectExternalVideoSchema.parse(request.body);
      const asset = await videoService.connectExternalVideo(input);
      return reply.status(201).send({ data: asset });
    }
  );

  // Attach video to lesson (Admin only)
  app.post(
    '/lessons/:lessonId/attach',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { lessonId } = z.object({ lessonId: z.string().uuid() }).parse(request.params);
      const { videoAssetId } = attachVideoSchema.parse(request.body);
      const lesson = await videoService.attachVideoToLesson(lessonId, videoAssetId);
      return reply.send({ data: lesson });
    }
  );

  // Detach video from lesson (Admin only)
  app.delete(
    '/lessons/:lessonId/detach',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { lessonId } = z.object({ lessonId: z.string().uuid() }).parse(request.params);
      const lesson = await videoService.detachVideoFromLesson(lessonId);
      return reply.send({ data: lesson });
    }
  );

  // Get video asset details with preview playback (Admin only)
  app.get(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const asset = await videoService.getVideoAssetById(id);
      return reply.send({ data: asset });
    }
  );

  // Delete video asset (Admin only)
  app.delete(
    '/:id',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await videoService.deleteVideoAsset(id);
      return reply.send({ data: result });
    }
  );

  // Mock Upload Handler for testing & local development
  app.put('/mock-upload/:id', async (request, reply) => {
    return reply.status(200).send({ success: true, message: 'Mock file received' });
  });
  app.post('/mock-upload/:id', async (request, reply) => {
    return reply.status(200).send({ success: true, message: 'Mock file received' });
  });
}
