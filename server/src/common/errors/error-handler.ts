import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { env } from '../../config/env.js';

import { sanitizeErrorMessage } from '../../plugins/request-logger.js';

export const errorHandler = (
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Only log unexpected 500 errors to request.log, and ensure sensitive values are redacted
  const isOperational = error instanceof AppError || error instanceof ZodError;
  if (!isOperational) {
    const safeMsg = sanitizeErrorMessage(error.message);
    if (safeMsg !== error.message) {
      error.message = safeMsg;
    }
    request.log.error(error);
  }

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

  // Prisma / Database connection failure or unhandled Prisma error
  const isPrismaError =
    error.name === 'PrismaClientInitializationError' ||
    error.name === 'PrismaClientRustPanicError' ||
    error.name === 'PrismaClientUnknownRequestError' ||
    ('code' in error && (error.code === 'ECONNREFUSED' || error.code === 'P1001' || error.code === 'P1002' || error.code === 'P1008' || error.code === 'P1017')) ||
    (typeof error.message === 'string' && (
      error.message.includes('Invalid `prisma.') ||
      error.message.includes("Can't reach database server") ||
      error.message.includes('ECONNREFUSED')
    ));

  if (isPrismaError) {
    request.log.error({ err: error }, 'Database connection error');
    return reply.status(503).send({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database service is temporarily unavailable. Please try again shortly.'
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
  const hasInternalLeak =
    typeof error.message === 'string' &&
    (error.message.includes('prisma') ||
     error.message.includes('\\') ||
     error.message.includes('/') ||
     error.message.includes('SELECT ') ||
     error.message.includes('findFirst'));

  return reply.status(500).send({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProd || hasInternalLeak ? 'An internal server error occurred. Please try again later.' : error.message
    }
  });
};
