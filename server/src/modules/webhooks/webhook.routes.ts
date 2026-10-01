import { FastifyInstance } from 'fastify';
import { handleMuxWebhook } from '../videos/video.service.js';
import { BadRequestError } from '../../common/errors/app-error.js';

export async function webhookRoutes(app: FastifyInstance) {
  /**
   * Mux Webhook Endpoint
   * Signature verified against MUX_WEBHOOK_SECRET using rawBody.
   * Idempotent event processor.
   */
  app.post('/mux', async (request, reply) => {
    const rawBody = request.rawBody || (typeof request.body === 'string' ? request.body : JSON.stringify(request.body));
    const headers = request.headers as Record<string, any>;

    if (!rawBody) {
      throw new BadRequestError('Raw body is missing for webhook verification');
    }

    try {
      const result = await handleMuxWebhook(rawBody, headers);
      return reply.status(200).send(result);
    } catch (err: any) {
      request.log.error({ err }, 'Mux webhook verification or handling failed');
      return reply.status(400).send({
        error: 'Webhook verification failed',
        message: err.message
      });
    }
  });
}
