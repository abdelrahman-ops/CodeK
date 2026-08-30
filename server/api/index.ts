import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

let app: FastifyInstance | null = null;

async function getAppInstance(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export default async function handler(req: any, res: any) {
  try {
    const fastifyApp = await getAppInstance();
    fastifyApp.server.emit('request', req, res);
  } catch (err: any) {
    console.error('❌ Serverless Function Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        error: {
          code: 'FUNCTION_INITIALIZATION_ERROR',
          message: err?.message || 'Serverless Fastify failed to initialize',
          stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined
        }
      })
    );
  }
}
