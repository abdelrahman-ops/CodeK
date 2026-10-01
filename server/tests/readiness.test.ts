import { describe, it, expect } from 'vitest';
import { getTestApp } from './helpers/test-app.js';

describe('Phase 6: Health and Readiness Observability Probes', () => {
  it('GET /health returns process liveness status 200 with timestamp', async () => {
    const app = await getTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('healthy');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('env');
  });

  it('GET /ready returns database connectivity readiness 200 with status ready', async () => {
    const app = await getTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/ready'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ready');
    expect(body.database).toBe('connected');
    expect(body).toHaveProperty('timestamp');
    // Invariant: Never leak database credentials or internal connection strings
    expect(body).not.toHaveProperty('url');
    expect(body).not.toHaveProperty('connectionString');
    expect(body).not.toHaveProperty('password');
  });
});
