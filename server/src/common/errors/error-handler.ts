import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { env } from '../../config/env.js';

export const errorHandler = (
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  request.log.error(error);

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request input data',
        details: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message
        }))
      }
    });
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      }
    });
  }

  // Fastify Schema Validation Error
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      error: {
        code: 'SCHEMA_VALIDATION_ERROR',
        message: error.message
      }
    });
  }

  // Prisma unique constraint violation code P2002
  if ('code' in error && error.code === 'P2002') {
    return reply.status(409).send({
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: 'A resource with this unique identifier or field already exists'
      }
    });
  }

  // Fastify Rate Limit or HTTP Status Errors (e.g., 429)
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const statusCode = error.statusCode;
    return reply.status(statusCode).send({
      error: {
        code: statusCode === 429 ? 'RATE_LIMIT_EXCEEDED' : 'HTTP_ERROR',
        message: error.message
      }
    });
  }

  // Generic fallback
  const isProd = env.NODE_ENV === 'production';
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProd ? 'An internal server error occurred' : error.message
    }
  });
};
