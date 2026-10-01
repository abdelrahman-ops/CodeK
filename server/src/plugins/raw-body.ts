import { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export async function registerRawBody(app: FastifyInstance) {
  // Capture raw string for webhook signature verification without breaking standard JSON parsing
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body: Buffer, done) => {
    try {
      const rawString = body.toString('utf-8');
      (req as any).rawBody = rawString;
      if (body.length === 0) {
        done(null, null);
        return;
      }
      const json = JSON.parse(rawString);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });
}
