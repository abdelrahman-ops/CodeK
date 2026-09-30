import { buildApp } from './app.js';
import { env } from './config/env.js';
import { prisma, pool } from './db/prisma.js';

async function start() {
  const app = await buildApp();

  let isShuttingDown = false;
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  for (const signal of signals) {
    process.on(signal, async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      app.log.info(`Received ${signal}, initiating graceful shutdown...`);

      try {
        await app.close();
        await prisma.$disconnect();
        await pool.end();
        app.log.info('Graceful shutdown completed successfully.');
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    });
  }

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Academy Backend Server running on http://${env.HOST}:${env.PORT}`);
    app.log.info(`Swagger API Docs available at http://${env.HOST}:${env.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Platform Server Entrypoint
if (process.env.VERCEL !== '1') {
  start();
}
