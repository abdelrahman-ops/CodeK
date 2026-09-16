import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { getLessonAccess } from '../src/modules/access/access.service.js';
import { LessonAccessType, AttendanceStatus } from '@prisma/client';

describe('Phase 7: Manual Hybrid Billing & Entitlement', () => {
  let app: FastifyInstance;
  let adminToken: string;

  let hybridStudentId: string;
  let hybridStudentToken: string;

  let onlineStudentId: string;
  let onlineStudentToken: string;

  let premiumLessonId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Create Hybrid student
    const emailHybrid = `hybrid_billing_${Date.now()}@codek.local`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Hybrid',
        lastName: 'Billing',
        email: emailHybrid,
        password: 'Password@123'
      }
    });
    const hybridUserId = regRes.json().data.userId;
    const otp = regRes.json().data.devOtp;

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { userId: hybridUserId, otpCode: otp }
    });
    hybridStudentToken = verifyRes.json().data.accessToken;
    hybridStudentId = verifyRes.json().data.user.student.id;

    // Set Hybrid mode
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-learning-mode',
      headers: { authorization: `Bearer ${hybridStudentToken}` },
      payload: { mode: 'HYBRID' }
    });

    // Create Online student
    const emailOnline = `online_billing_${Date.now()}@codek.local`;
    const regRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        firstName: 'Online',
        lastName: 'Billing',
        email: emailOnline,
        password: 'Password@123'
      }
    });
    const onlineUserId = regRes2.json().data.userId;
    const otp2 = regRes2.json().data.devOtp;

    const verifyRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { userId: onlineUserId, otpCode: otp2 }
    });
    onlineStudentToken = verifyRes2.json().data.accessToken;
    onlineStudentId = verifyRes2.json().data.user.student.id;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-learning-mode',
      headers: { authorization: `Bearer ${onlineStudentToken}` },
      payload: { mode: 'ONLINE' }
    });

    // Ensure a Course, Section, and Premium (non-free) Lesson exist
    let course = await prisma.curriculum.findFirst();
    if (!course) {
      course = await prisma.curriculum.create({
        data: {
          title: 'Test Billing Track',
          description: 'Track for billing tests',
          isPublished: true
        }
      });
    }

    let section = await prisma.section.findFirst({ where: { curriculumId: course.id } });
    if (!section) {
      section = await prisma.section.create({
        data: {
          curriculumId: course.id,
          title: 'Section 1',
          order: 1,
          isPublished: true
        }
      });
    }

    const lesson = await prisma.lesson.create({
      data: {
        sectionId: section.id,
        curriculumId: course.id,
        title: 'Premium Coding Challenge',
        content: 'Premium coding challenge content',
        order: 99,
        isFree: false,
        accessType: LessonAccessType.SUBSCRIPTION,
        isPublished: true
      }
    });
    premiumLessonId = lesson.id;
  });

  // 1. Non-admin cannot record manual payment
  it('1. non-admin student should receive 403 when attempting to record manual payment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/manual-payment',
      headers: { authorization: `Bearer ${hybridStudentToken}` },
      payload: { studentId: hybridStudentId }
    });

    expect(res.statusCode).toBe(403);
  });

  // 2. Cannot record manual payment for Online student
  it('2. admin cannot record manual payment for an Online student', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/manual-payment',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { studentId: onlineStudentId }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/Hybrid students/i);
  });

  // 3. Unpaid Hybrid student cannot access premium lesson
  it('3. unpaid Hybrid student cannot access premium lesson (SUBSCRIPTION_REQUIRED)', async () => {
    const access = await getLessonAccess(hybridStudentId, premiumLessonId);
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('SUBSCRIPTION_REQUIRED');
  });

  const key1 = `pay_test_key_1_${Date.now()}`;
  const key2 = `pay_test_key_2_${Date.now()}`;

  // 4. Admin records manual payment for Hybrid student
  it('4. admin can record manual payment for Hybrid student, activating 30-day subscription', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/manual-payment',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        studentId: hybridStudentId,
        notes: 'Paid 250 EGP cash at academy reception',
        idempotencyKey: key1
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.transaction.status).toBe('PAID');
    expect(body.data.transaction.provider).toBe('MANUAL');
    expect(body.data.transaction.amount).toBe(250);
    expect(body.data.subscription.status).toBe('ACTIVE');

    // Check duration is approximately 30 days
    const start = new Date(body.data.subscription.currentPeriodStart).getTime();
    const end = new Date(body.data.subscription.currentPeriodEnd).getTime();
    const daysDiff = Math.round((end - start) / (1000 * 3600 * 24));
    expect(daysDiff).toBe(30);
  });

  // 5. Paid Hybrid student can access premium lesson
  it('5. paid Hybrid student can now access premium lesson', async () => {
    const access = await getLessonAccess(hybridStudentId, premiumLessonId);
    expect(access.allowed).toBe(true);
  });

  // 6. Idempotent re-submission does not double-extend
  it('6. duplicate submit with same idempotencyKey does not double-extend subscription', async () => {
    const subBefore = await prisma.subscription.findFirst({
      where: { studentId: hybridStudentId }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/manual-payment',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        studentId: hybridStudentId,
        idempotencyKey: key1
      }
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.isDuplicate).toBe(true);

    const subAfter = await prisma.subscription.findFirst({
      where: { studentId: hybridStudentId }
    });
    expect(subAfter!.currentPeriodEnd.getTime()).toBe(subBefore!.currentPeriodEnd.getTime());
  });

  // 7. Legitimate renewal extends from existing period end
  it('7. legitimate future payment extends subscription by 30 days from current period end', async () => {
    const subBefore = await prisma.subscription.findFirst({
      where: { studentId: hybridStudentId }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/admin/manual-payment',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        studentId: hybridStudentId,
        idempotencyKey: key2,
        notes: 'Second month cash payment'
      }
    });

    expect(res.statusCode).toBe(201);
    const subAfter = await prisma.subscription.findFirst({
      where: { studentId: hybridStudentId }
    });

    // Should be extended by exactly 30 days from previous periodEnd
    const expectedEnd = new Date(subBefore!.currentPeriodEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(Math.abs(subAfter!.currentPeriodEnd.getTime() - expectedEnd.getTime())).toBeLessThan(5000);
  });

  // 8. Hybrid absent Saturday student still has online access
  it('8. Hybrid student marked ABSENT on Saturday session still retains online access', async () => {
    // Create a group and session
    let group = await prisma.group.findFirst();
    if (!group) {
      group = await prisma.group.create({
        data: { name: 'Hybrid Saturday Group', maxCapacity: 25 }
      });
    }

    const session = await prisma.session.create({
      data: {
        groupId: group.id,
        sessionNumber: Math.floor(Math.random() * 90000) + 10000,
        date: new Date(),
        startTime: '10:00',
        endTime: '12:00',
        status: 'COMPLETED'
      }
    });

    // Record ABSENT attendance for hybrid student
    await prisma.attendance.create({
      data: {
        sessionId: session.id,
        studentId: hybridStudentId,
        status: AttendanceStatus.ABSENT,
        notes: 'Missed Saturday in-person session'
      }
    });

    // Educational access check: still allowed because online subscription is ACTIVE!
    const access = await getLessonAccess(hybridStudentId, premiumLessonId);
    expect(access.allowed).toBe(true);
  });
});
