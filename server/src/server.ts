import { buildApp } from './app.js';
import { env } from './config/env.js';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Academy Backend Server running on http://${env.HOST}:${env.PORT}`);
    app.log.info(`Swagger API Docs available at http://${env.HOST}:${env.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.VERCEL !== '1') {
  start();
}
