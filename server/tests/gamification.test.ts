import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';

describe('Gamification & Monthly Anonymous Leaderboard Module', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let omarToken: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    const now = new Date();
    await prisma.monthlyLeaderboardEntry.deleteMany({
      where: { leaderboard: { year: now.getFullYear(), month: now.getMonth() + 1 } }
    });
    await prisma.monthlyLeaderboard.deleteMany({
      where: { year: now.getFullYear(), month: now.getMonth() + 1 }
    });

    const omarRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    omarToken = omarRes.json().data.accessToken;
  });

  it('should deliver anonymous leaderboard to students during active month', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/gamification/leaderboard',
      headers: { authorization: `Bearer ${omarToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.status).toBe('ACTIVE');
    expect(body.entries.length).toBeGreaterThanOrEqual(1);

    const firstEntry = body.entries[0];
    expect(firstEntry).toHaveProperty('rank');
    expect(firstEntry).toHaveProperty('anonymousCode');
    expect(firstEntry).toHaveProperty('monthlyXp');

    // Other students' names must NOT be visible
    const otherEntries = body.entries.filter((e: any) => !e.isCurrentStudent);
    if (otherEntries.length > 0) {
      expect(otherEntries[0].studentName).toBeUndefined();
    }
  });

  it('should allow Admin to view real identities in live leaderboard', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/gamification/leaderboard',
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    const firstEntry = body.entries[0];
    expect(firstEntry).toHaveProperty('studentName');
    expect(firstEntry).toHaveProperty('studentCode');
  });

  it('should finalize monthly leaderboard and reveal rankings', async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/gamification/leaderboard/finalize',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { year, month }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('FINALIZED');
  });
});
