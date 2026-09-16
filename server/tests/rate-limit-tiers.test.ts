import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';

describe('P0 Rate Limiting Architecture & Concurrency', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);
  });

  it('allows high-concurrency parallel GET requests to /api/v1/curriculum without 429 rejection', async () => {
    // Simulate 35 parallel curriculum GET requests typical of Admin Curriculum page load
    const parallelRequests = Array.from({ length: 35 }).map(() =>
      app.inject({
        method: 'GET',
        url: '/api/v1/curriculum',
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      })
    );

    const responses = await Promise.all(parallelRequests);

    // Assert ALL requests succeed with 200 and none hit 429
    responses.forEach((res) => {
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toBeDefined();
    });
  });

  it('exempts /health liveness probe from rate limiting', async () => {
    const healthRequests = Array.from({ length: 20 }).map(() =>
      app.inject({
        method: 'GET',
        url: '/health'
      })
    );

    const responses = await Promise.all(healthRequests);
    responses.forEach((res) => {
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('healthy');
    });
  });

  it('preserves rate limiting headers on responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/curriculum',
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });
});
