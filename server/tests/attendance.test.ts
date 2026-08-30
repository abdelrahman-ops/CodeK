import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';

describe('Attendance and Content Unlocking Module', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;
  let studentUserId: string;
  let studentId: string;
  let groupId: string;
  let lessonId: string;
  let sessionId: string;
  let qrToken: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Clean up any leftovers from previous runs
    await prisma.attendance.deleteMany({ where: { session: { sessionNumber: 99 } } });
    await prisma.sessionLesson.deleteMany({ where: { session: { sessionNumber: 99 } } });
    await prisma.session.deleteMany({ where: { sessionNumber: 99 } });
    await prisma.curriculum.deleteMany({ where: { title: 'Attendance Unlock Test Track' } });

    // Student login (STU-1003 Nour Ibrahim - enrolled in Group A)
    const studentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1003', password: 'Student@123' }
    });
    studentToken = studentRes.json().data.accessToken;
    studentUserId = studentRes.json().data.user.id;
    studentId = studentRes.json().data.user.student.id;

    // Fetch Group A
    const groupsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const groupA = groupsRes.json().data.find((g: any) => g.name === 'Group A');
    groupId = groupA.id;

    // Create a special test curriculum & lesson
    const curRes = await app.inject({
      method: 'POST',
      url: '/api/v1/curriculum',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Attendance Unlock Test Track',
        type: 'ACADEMY'
      }
    });
    const curriculumId = curRes.json().data.id;

    const lessonRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId,
        title: 'Secret Unlocked Mission',
        content: '# Secret Super Content\nThis is top secret until you attend!',
        difficulty: 'BEGINNER'
      }
    });
    lessonId = lessonRes.json().data.id;

    // Create a new session for Group A linked to this lesson
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        groupId,
        sessionNumber: 99,
        date: new Date().toISOString(),
        startTime: '18:00',
        endTime: '19:30',
        lessonIds: [lessonId]
      }
    });
    sessionId = sessionRes.json().data.id;
  });

  it('should show lesson as locked BEFORE attendance is confirmed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/lessons/${lessonId}`,
      headers: { authorization: `Bearer ${studentToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.isLocked).toBe(true);
    expect(body.lockReason).toBe('ATTENDANCE_REQUIRED');
    expect(body.content).toBeNull();
  });

  it('should start session and generate QR attendance token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionId}/start`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.status).toBe('ACTIVE');
    expect(body.qrToken).toBeDefined();
    qrToken = body.qrToken;
  });

  it('should reject invalid QR token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/confirm-student',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        sessionId,
        qrToken: 'invalid_token_123'
      }
    });

    expect(res.statusCode).toBe(400);
  });

  it('should confirm attendance with valid QR token, mark PRESENT, and award +10 XP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/confirm-student',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        sessionId,
        qrToken
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.attendance.status).toBe('PRESENT');
    expect(body.xpAwarded).toBe(10);
  });

  it('should unlock lesson content immediately AFTER attendance confirmation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/lessons/${lessonId}`,
      headers: { authorization: `Bearer ${studentToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.isLocked).toBe(false);
    expect(body.content).toContain('Secret Super Content');
  });

  it('should allow admin manual attendance mark and reflect in roster', async () => {
    // Admin marks student PRESENT manually
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/admin-mark',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        sessionId,
        studentId,
        status: 'PRESENT',
        notes: 'Marked present manually by instructor'
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('PRESENT');
    expect(res.json().data.isManual).toBe(true);

    // View roster
    const rosterRes = await app.inject({
      method: 'GET',
      url: `/api/v1/attendance/session/${sessionId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(rosterRes.statusCode).toBe(200);
    const roster = rosterRes.json().data;
    expect(roster.presentCount).toBeGreaterThanOrEqual(1);
    const record = roster.roster.find((r: any) => r.studentId === studentId);
    expect(record.status).toBe('PRESENT');
  });
});
