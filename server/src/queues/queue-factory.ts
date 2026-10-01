import { Queue, QueueOptions, DefaultJobOptions } from 'bullmq';
import { createRedisClient, getRedisConnection, isRedisConfigured } from '../infrastructure/redis/redis.js';
import { QueueName } from './queue-names.js';
import { env } from '../config/env.js';

export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    count: 500, // keep latest 500 completed jobs
    age: 24 * 3600, // retain up to 24 hours
  },
  removeOnFail: {
    count: 1000, // retain up to 1000 failed jobs for diagnosis
    age: 7 * 24 * 3600, // retain 7 days
  },
};

const queueRegistry = new Map<string, Queue>();

/**
 * Creates or retrieves a cached BullMQ Queue instance.
 * Returns null if Redis is not configured (e.g. Vercel serverless without hosted Redis).
 */
export function getOrCreateQueue<T = any>(
  queueName: QueueName,
  customOptions?: Partial<QueueOptions>
): Queue<T> | null {
  if (!isRedisConfigured()) {
    return null;
  }

  if (queueRegistry.has(queueName)) {
    return queueRegistry.get(queueName)! as Queue<T>;
  }

  const redisConnection = createRedisClient();
  const prefix = env.NODE_ENV === 'test' ? 'bull:test' : (env.BULLMQ_PREFIX || 'bull');

  const options: QueueOptions = {
    connection: redisConnection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
    prefix,
    ...customOptions,
  };

  const queue = new Queue<T>(queueName, options);

  queue.on('error', (err) => {
    // Only log queue errors if connection is active
    console.error(`[BullMQ:${queueName}] Queue error:`, err.message);
  });

  queueRegistry.set(queueName, queue);
  return queue;
}

/**
 * Closes all registered BullMQ queue instances.
 */
export async function closeAllQueues(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const queue of queueRegistry.values()) {
    promises.push(queue.close());
  }
  queueRegistry.clear();
  await Promise.allSettled(promises);
}
