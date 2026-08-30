import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
    allowList: (req) => {
      // Allow internal healthchecks or test agent loopbacks if configured
      return false;
    }
  });
}
