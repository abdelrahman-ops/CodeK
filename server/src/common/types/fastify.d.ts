import { TokenPayload } from '../utils/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}
