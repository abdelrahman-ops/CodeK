import { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env.js';

/**
 * Extracts userId from Bearer JWT payload without cryptographic verification.
 * (Full cryptographic verification is strictly enforced downstream by the authenticate preHandler).
 * This enables per-user rate limiting so authenticated users never share an IP rate limit bucket.
 */
function extractUserIdFromRequest(req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      if (payload && payload.userId && typeof payload.userId === 'string') {
        return payload.userId;
      }
    }
  } catch {
    // Ignore malformed token and fall back to IP
  }
  return null;
}

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    timeWindow: '1 minute',
    keyGenerator: (req: FastifyRequest) => {
      const userId = extractUserIdFromRequest(req);
      if (userId) {
        return `user:${userId}`;
      }
      return req.ip || '127.0.0.1';
    },
    max: (req: FastifyRequest) => {
      const isTest = env.NODE_ENV === 'test';
      if (isTest) {
        return 10000;
      }

      const isDev = env.NODE_ENV === 'development';
      const url = (req.url || '').split('?')[0];
      const method = req.method.toUpperCase();

      // 1. Sensitive authentication endpoints (tight protection against brute force)
      if (
        url.startsWith('/api/v1/auth/login') ||
        url.startsWith('/api/v1/auth/register') ||
        url.startsWith('/api/v1/auth/verify') ||
        url.startsWith('/api/v1/auth/reset-password') ||
        url.startsWith('/api/v1/auth/setup-password')
      ) {
        return isDev ? 100 : 30;
      }

      // 2. Normal read / data-fetching APIs (GET):
      // Allows realistic SPA concurrency (curriculum, lessons, videos, content, profile)
      if (method === 'GET') {
        return isDev ? 3000 : 1200;
      }

      // 3. Regular application mutations (POST, PUT, PATCH, DELETE on standard resources)
      return isDev ? 600 : 180;
    },
    allowList: (req: FastifyRequest) => {
      // Exclude liveness/readiness probes from rate limiting
      const path = (req.url || '').split('?')[0];
      return path === '/health' || path === '/';
    }
  });
}
