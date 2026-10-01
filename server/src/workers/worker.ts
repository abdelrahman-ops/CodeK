import { prisma } from '../db/prisma.js';
import { getRedisConnection, closeRedisConnections, sanitizeRedisUrl } from '../infrastructure/redis/redis.js';
import { EmailWorker } from '../queues/email/email.worker.js';
import { VideoWorker } from '../queues/video/video.worker.js';
import { env } from '../config/env.js';

async function startWorker() {
  console.log('====================================================');
  console.log('⚡ CodeK Academy Background Worker Service');
  console.log('====================================================');
  console.log(`Environment:  ${env.NODE_ENV}`);
  console.log(`Redis:        ${sanitizeRedisUrl(env.REDIS_URL)}`);
  console.log(`Concurrency:  email=${env.WORKER_CONCURRENCY_EMAIL}, video=${env.WORKER_CONCURRENCY_VIDEO}`);
  console.log('====================================================');

  // Verify Redis connectivity
  const redis = getRedisConnection();
  try {
    await redis.ping();
    console.log('[Worker] Connected to Redis successfully.');
  } catch (err: any) {
    console.warn('[Worker] Warning: Initial Redis ping failed:', err.message);
  }

  // Initialize workers
  const emailWorker = new EmailWorker();
  const videoWorker = new VideoWorker();
  console.log('[Worker] BullMQ workers (email, video) started and listening for jobs.');

  // Graceful shutdown handling
  let isShuttingDown = false;
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  for (const signal of signals) {
    process.on(signal, async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\n[Worker] Received ${signal}, starting graceful shutdown...`);

      try {
        console.log('[Worker] Closing BullMQ workers and draining active jobs...');
        await Promise.allSettled([
          emailWorker.close(),
          videoWorker.close(),
        ]);

        console.log('[Worker] Closing Redis connections...');
        await closeRedisConnections();

        console.log('[Worker] Disconnecting Prisma...');
        await prisma.$disconnect();

        console.log('[Worker] Graceful shutdown completed cleanly.');
        process.exit(0);
      } catch (err: any) {
        console.error('[Worker] Error during shutdown:', err);
        process.exit(1);
      }
    });
  }
}

startWorker().catch((err) => {
  console.error('[Worker] Fatal error on startup:', err);
  process.exit(1);
});
