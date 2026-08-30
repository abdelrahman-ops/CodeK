import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { env } from '../config/env.js';

export async function registerSecurity(app: FastifyInstance) {
  const allowedOrigins = env.CORS_ORIGIN.split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server health checks)
      if (!origin) {
        cb(null, true);
        return;
      }

      if (env.CORS_ORIGIN === '*' || allowedOrigins.includes('*')) {
        cb(null, true);
        return;
      }

      const normalizedOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        cb(null, true);
        return;
      }

      // Also allow local development origins if testing against hosted backend
      if (
        normalizedOrigin.startsWith('http://localhost:') ||
        normalizedOrigin.startsWith('http://127.0.0.1:') ||
        normalizedOrigin.endsWith('.vercel.app')
      ) {
        cb(null, true);
        return;
      }

      cb(new Error(`CORS origin '${origin}' not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  });

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production'
  });

  await app.register(cookie, {
    secret: env.JWT_REFRESH_SECRET,
    parseOptions: {}
  });
}
