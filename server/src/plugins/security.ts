import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { env } from '../config/env.js';

export async function registerSecurity(app: FastifyInstance) {
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim());

  await app.register(cors, {
    origin: (origin, cb) => {
      // In development, allow no-origin (like Postman or server-to-server) or wildcard
      if (!origin || env.CORS_ORIGIN === '*') {
        cb(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('CORS origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production'
  });

  await app.register(cookie, {
    secret: env.JWT_REFRESH_SECRET,
    parseOptions: {}
  });
}
