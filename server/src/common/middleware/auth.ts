import { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';
import { verifyAccessToken } from '../utils/jwt.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyAccessToken(token);

  if (payload.isEmailVerified === false) {
    throw new ForbiddenError('Account email is not verified');
  }

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
