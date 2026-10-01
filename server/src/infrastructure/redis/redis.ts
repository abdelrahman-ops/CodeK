import { Redis, RedisOptions } from 'ioredis';
import { env } from '../../config/env.js';

let sharedClient: Redis | null = null;
const activeClients = new Set<Redis>();

/**
 * Sanitizes a Redis connection string for safe logging (masks passwords).
 */
export function sanitizeRedisUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = '******';
    }
    return parsed.toString();
  } catch {
    return 'redis://[redacted]';
  }
}

/**
 * Builds standard connection options required by BullMQ.
 * maxRetriesPerRequest MUST be null for BullMQ queues and workers.
 */
export function getRedisOptions(override?: Partial<RedisOptions>): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times: number) {
      // Exponential backoff capped at 3000ms
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    ...override
  };
}

/**
 * Creates a new dedicated Redis connection (e.g. for BullMQ workers/listeners).
 */
export function createRedisClient(override?: Partial<RedisOptions>): Redis {
  const options = getRedisOptions(override);

  // In test environment, if using ioredis-mock
  if (process.env.NODE_ENV === 'test' && process.env.USE_MOCK_REDIS === '1') {
    // Dynamic import of ioredis-mock for isolated test executions
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RedisMock = require('ioredis-mock');
      const mock = new RedisMock();
      activeClients.add(mock);
      return mock;
    } catch {
      // Fall through to real Redis if mock not available
    }
  }

  const client = new Redis(env.REDIS_URL, options);

  client.on('error', (err) => {
    // Avoid noisy error logs during planned disconnections or tests
    if (client.status === 'end' || client.status === 'close') return;
    console.error(`[Redis] Connection error (${sanitizeRedisUrl(env.REDIS_URL)}):`, err.message);
  });

  activeClients.add(client);
  return client;
}

/**
 * Returns a shared Redis connection for general queue producers.
 */
export function getRedisConnection(): Redis {
  if (!sharedClient || sharedClient.status === 'end') {
    sharedClient = createRedisClient();
  }
  return sharedClient;
}

/**
 * Gracefully terminates all tracked Redis connections.
 */
export async function closeRedisConnections(): Promise<void> {
  const closePromises: Promise<any>[] = [];

  for (const client of activeClients) {
    if (client.status !== 'end') {
      closePromises.push(
        client.quit().catch(() => {
          client.disconnect();
        })
      );
    }
  }

  activeClients.clear();
  sharedClient = null;

  await Promise.allSettled(closePromises);
}
