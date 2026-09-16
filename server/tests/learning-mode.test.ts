import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';

describe('Phase 7: Learning Mode Onboarding (Online vs Hybrid)', () => {
  let app: FastifyInstance;
  let adminToken: string;

  let onlineStudentToken: string;
  let onlineStudentId: string;
  let onlineUserId: string;

  let hybridStudentToken: string;
  let hybridStudentId: string;
  let hybridUserId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Create & verify Student 1 (for Online)
    const email1 = `online_mode_${Date.now()}@codek.local`;
    const regRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Online',
        lastName: 'Student',
        email: email1,
        password: 'Password@123'
      }
    });
    onlineUserId = regRes1.json().data.userId;
    const otp1 = regRes1.json().data.devOtp;

    const verifyRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { userId: onlineUserId, otpCode: otp1 }
    });
    onlineStudentToken = verifyRes1.json().data.accessToken;
    onlineStudentId = verifyRes1.json().data.user.student.id;

    // Create & verify Student 2 (for Hybrid)
    const email2 = `hybrid_mode_${Date.now()}@codek.local`;
    const regRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Hybrid',
        lastName: 'Student',
        email: email2,
        password: 'Password@123'
      }
    });
    hybridUserId = regRes2.json().data.userId;
    const otp2 = regRes2.json().data.devOtp;

    const verifyRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { userId: hybridUserId, otpCode: otp2 }
    });
    hybridStudentToken = verifyRes2.json().data.accessToken;
    hybridStudentId = verifyRes2.json().data.user.student.id;
  });

  // 1. Online selection persists attendanceRequired=false, learningModeSelected=true
  it('1. selecting ONLINE persists attendanceRequired=false and learningModeSelected=true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-learning-mode',
      headers: { authorization: `Bearer ${onlineStudentToken}` },
      payload: { mode: 'ONLINE' }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.mode).toBe('ONLINE');
    expect(body.data.student.attendanceRequired).toBe(false);
    expect(body.data.student.learningModeSelected).toBe(true);

    const studentInDb = await prisma.student.findUnique({
      where: { id: onlineStudentId }
    });
    expect(studentInDb!.attendanceRequired).toBe(false);
    expect(studentInDb!.learningModeSelected).toBe(true);
  });

  // 2. Mode selection creates NO subscription and NO payment
  it('2. mode selection creates NO subscription and NO payment transaction', async () => {
    const sub = await prisma.subscription.findFirst({
      where: { studentId: onlineStudentId }
    });
    expect(sub).toBeNull();

    const txn = await prisma.paymentTransaction.findFirst({
      where: { studentId: onlineStudentId }
    });
    expect(txn).toBeNull();
  });

  // 3. Student cannot re-select learning mode (Admin controlled only)
  it('3. student cannot change learning mode once selected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-learning-mode',
      headers: { authorization: `Bearer ${onlineStudentToken}` },
      payload: { mode: 'HYBRID' }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/already been selected/i);
  });

  // 4. Hybrid selection persists attendanceRequired=true, learningModeSelected=true
  it('4. selecting HYBRID persists attendanceRequired=true and learningModeSelected=true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-learning-mode',
      headers: { authorization: `Bearer ${hybridStudentToken}` },
      payload: { mode: 'HYBRID' }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.mode).toBe('HYBRID');
    expect(body.data.student.attendanceRequired).toBe(true);
    expect(body.data.student.learningModeSelected).toBe(true);

    const studentInDb = await prisma.student.findUnique({
      where: { id: hybridStudentId }
    });
    expect(studentInDb!.attendanceRequired).toBe(true);
    expect(studentInDb!.learningModeSelected).toBe(true);
  });

  // 5. Non-student (Admin) cannot call select-learning-mode
  it('5. non-student role cannot call select-learning-mode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-learning-mode',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { mode: 'ONLINE' }
    });

    expect(res.statusCode).toBe(403);
  });

  // 6. Grandfathered existing student retains existing settings and is marked onboarded
  it('6. grandfathered student STU-1001 is already marked as learningModeSelected=true', async () => {
    const student = await prisma.student.findFirst({
      where: { studentCode: 'STU-1001' }
    });
    expect(student).not.toBeNull();
    expect(student!.learningModeSelected).toBe(true);
  });
});
