import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';

describe('Groups, Classmate Peer Visibility & Safe Deletions Module', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let omarToken: string; // Group A
  let mariamToken: string; // Group B
  let groupAId: string;
  let groupBId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    const omarRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    omarToken = omarRes.json().data.accessToken;

    const mariamRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1004', password: 'Student@123' }
    });
    mariamToken = mariamRes.json().data.accessToken;

    const groupsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${adminToken}` }
    });

    const groups = groupsRes.json().data;
    groupAId = groups.find((g: any) => g.name === 'Group A').id;
    groupBId = groups.find((g: any) => g.name === 'Group B').id;
  });

  it('should allow student (Omar) to view classmates in their active Group A', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${groupAId}`,
      headers: { authorization: `Bearer ${omarToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.name).toBe('Group A');
    expect(body.members).toBeDefined();
    expect(body.members.length).toBeGreaterThanOrEqual(1);

    // Verify privacy: sensitive fields must NOT be exposed
    const classmate = body.members[0];
    expect(classmate).toHaveProperty('displayName');
    expect(classmate).toHaveProperty('achievements');
    expect(classmate).not.toHaveProperty('anonymousLeaderboardCode');
    expect(classmate).not.toHaveProperty('totalXp');
    expect(classmate).not.toHaveProperty('currentStreak');
    expect(classmate).not.toHaveProperty('phone');
    expect(classmate).not.toHaveProperty('email');
    expect(classmate).not.toHaveProperty('passwordHash');
    expect(classmate).not.toHaveProperty('dateOfBirth');
  });

  it('should FORBID student (Omar) from viewing other group (Group B)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${groupBId}`,
      headers: { authorization: `Bearer ${omarToken}` }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('should allow Admin to view full group details with contact info', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${groupAId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.enrollments).toBeDefined();
  });

  it('should block deletion of Group A because it has historical sessions/enrollments', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/groups/${groupAId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
  });

  it('should allow safe deletion of a newly created empty group', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Temporary Empty Group',
        scheduleInfo: 'Thursday 4 PM',
        maxCapacity: 15
      }
    });
    expect(createRes.statusCode).toBe(201);
    const emptyGroupId = createRes.json().data.id;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/groups/${emptyGroupId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().data.success).toBe(true);
  });
});
