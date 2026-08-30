import { FastifyReply, FastifyRequest } from 'fastify';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(request.user.role)) {
      throw new ForbiddenError(`Access denied. Requires one of roles: ${roles.join(', ')}`);
    }
  };
}

export const requireAdmin = requireRole(Role.ADMIN);
export const requireStudent = requireRole(Role.STUDENT);
export const requireParent = requireRole(Role.PARENT);
