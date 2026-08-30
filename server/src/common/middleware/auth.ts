import { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors/app-error.js';
import { verifyAccessToken } from '../utils/jwt.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyAccessToken(token);
  request.user = payload;
}

export async function optionalAuthenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7).trim();
      request.user = verifyAccessToken(token);
    } catch {
      // Ignore error for optional auth
    }
  }
}
