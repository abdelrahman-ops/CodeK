import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/common/utils/crypto.js';
import { AccessGrantScope, AttendanceStatus, LessonAccessType, Role } from '@prisma/client';

import { getTestApp, loginAdmin } from './helpers/test-app.js';

describe('Phase 1: Online-First Access Decoupling & Invariants', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let courseId: string;
  let paidLessonId: string;
  let freeLessonId: string;
  let legacyAttendanceLessonId: string;
  let planId: string;
  let saturdaySessionId: string;

  // Student test fixtures
  let localStudentToken: string;
  let localStudentId: string;
  let onlineStudentToken: string;
  let onlineStudentId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // 2. Create or verify 250 EGP Subscription Plan
    const plan = await prisma.subscriptionPlan.upsert({
      where: { code: 'PRO_MONTHLY_250_DEC' },
      update: { price: 250, isActive: true },
      create: {
        name: 'CodeK Academy Monthly 250',
        code: 'PRO_MONTHLY_250_DEC',
        price: 250,
        currency: 'EGP',
        billingInterval: 'MONTHLY',
        isActive: true
      }
    });
    planId = plan.id;

    // 3. Create Test Course & Lessons
    const unique = Date.now().toString().slice(-4);
    const courseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/curriculum',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `Decoupled Course ${unique}`,
        description: 'Testing attendance-independent online access',
        grade: 'GRADE_2'
      }
    });
    courseId = courseRes.json().data.id;

    // Free Preview Lesson
    const freeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: courseId,
        title: `Free Lesson ${unique}`,
        content: '# Free Lesson Content',
        order: 1,
        isFree: true,
        accessType: LessonAccessType.FREE
      }
    });
    freeLessonId = freeRes.json().data.id;

    // Paid Subscription Lesson
    const paidRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: courseId,
        title: `Paid Lesson ${unique}`,
        content: '# Premium Lesson Content',
        order: 2,
        isFree: false,
        accessType: LessonAccessType.SUBSCRIPTION_REQUIRED
      }
    });
    paidLessonId = paidRes.json().data.id;

    // Link a valid VideoAsset to the paid lesson for playback testing
    const videoAsset = await prisma.videoAsset.create({
      data: {
        title: `Decoupled Video ${unique}`,
        provider: 'MUX',
        providerVideoId: `mux_video_${unique}`,
        playbackId: `mux_playback_${unique}`,
        status: 'READY',
        isPrivate: false,
        durationSeconds: 120
      }
    });
    await prisma.lesson.update({
      where: { id: paidLessonId },
      data: { videoId: videoAsset.id }
    });

    // Legacy Lesson with accessType = ATTENDANCE_REQUIRED
    const legacyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: courseId,
        title: `Legacy Attendance Lesson ${unique}`,
        content: '# Legacy Attendance Content',
        order: 3,
        isFree: false,
        accessType: LessonAccessType.ATTENDANCE_REQUIRED
      }
    });
    legacyAttendanceLessonId = legacyRes.json().data.id;

    // 4. Create a Physical Saturday Group and Session
    const group = await prisma.group.create({
      data: {
        name: `Saturday Cohort ${unique}`,
        description: 'Physical attendance group',
        scheduleInfo: 'Saturday 10:00 AM'
      }
    });

    const session = await prisma.session.create({
      data: {
        groupId: group.id,
        sessionNumber: 1,
        date: new Date(),
        startTime: '10:00',
        endTime: '12:00',
        sessionLessons: {
          create: [
            { lessonId: paidLessonId, order: 1 },
            { lessonId: legacyAttendanceLessonId, order: 2 }
          ]
        }
      }
    });
    saturdaySessionId = session.id;

    // 5. Create Local Student (attendanceRequired = true)
    const pwdHash = await hashPassword('Student@123');
    const localUser = await prisma.user.create({
      data: {
        loginId: `STU-LOC-${unique}`,
        email: `local.student.${unique}@codek.com`,
        passwordHash: pwdHash,
        role: Role.STUDENT,
        firstName: 'Ahmed',
        lastName: 'Local',
        mustChangePassword: false,
        isEmailVerified: true,
        student: {
          create: {
            studentCode: `STU-LOC-${unique}`,
            attendanceRequired: true,
            learningModeSelected: true,
            grade: 'GRADE_2'
          }
        }
      },
      include: { student: true }
    });
    localStudentId = localUser.student!.id;

    // Enroll in Saturday physical group
    await prisma.groupEnrollment.create({
      data: {
        studentId: localStudentId,
        groupId: group.id,
        isActive: true
      }
    });

    const locLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: `STU-LOC-${unique}`, password: 'Student@123' }
    });
    localStudentToken = locLogin.json().data.accessToken;

    // 6. Create Online-Only Student (attendanceRequired = false)
    const onlineUser = await prisma.user.create({
      data: {
        loginId: `STU-ONL-${unique}`,
        email: `online.student.${unique}@codek.com`,
        passwordHash: pwdHash,
        role: Role.STUDENT,
        firstName: 'Sara',
        lastName: 'Online',
        mustChangePassword: false,
        isEmailVerified: true,
        student: {
          create: {
            studentCode: `STU-ONL-${unique}`,
            attendanceRequired: false,
            learningModeSelected: true,
            grade: 'GRADE_2'
          }
        }
      },
      include: { student: true }
    });
    onlineStudentId = onlineUser.student!.id;

    const onlLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: `STU-ONL-${unique}`, password: 'Student@123' }
    });
    onlineStudentToken = onlLogin.json().data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // TEST 1: ACTIVE subscription + attendanceRequired = true + Saturday PRESENT -> allowed
  it('Test 1: Student with active subscription and Saturday PRESENT can access paid lesson', async () => {
    // Give active subscription
    await prisma.subscription.create({
      data: {
        studentId: localStudentId,
        planId,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    // Mark Saturday attendance = PRESENT
    await prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId: saturdaySessionId, studentId: localStudentId } },
      update: { status: AttendanceStatus.PRESENT },
      create: {
        sessionId: saturdaySessionId,
        studentId: localStudentId,
        status: AttendanceStatus.PRESENT
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/access/lessons/${paidLessonId}/access`,
      headers: { authorization: `Bearer ${localStudentToken}` }
    });

    expect(res.statusCode).toBe(200);
    const decision = res.json().data;
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('ENROLLED');
  });

  // TEST 2: ACTIVE subscription + attendanceRequired = true + Saturday ABSENT -> allowed & subscription stays ACTIVE
  it('Test 2: Student with active subscription who is ABSENT on Saturday still has full online access and subscription remains ACTIVE', async () => {
    // Change Saturday attendance to ABSENT
    await prisma.attendance.update({
      where: { sessionId_studentId: { sessionId: saturdaySessionId, studentId: localStudentId } },
      data: { status: AttendanceStatus.ABSENT }
    });

    // Verify subscription status is still ACTIVE
    const sub = await prisma.subscription.findFirst({
      where: { studentId: localStudentId, status: 'ACTIVE' }
    });
    expect(sub).toBeDefined();
    expect(sub!.status).toBe('ACTIVE');

    // Access paid lesson
    const resPaid = await app.inject({
      method: 'GET',
      url: `/api/v1/access/lessons/${paidLessonId}/access`,
      headers: { authorization: `Bearer ${localStudentToken}` }
    });
    expect(resPaid.statusCode).toBe(200);
    expect(resPaid.json().data.allowed).toBe(true);

    // Access legacy lesson (which previously had accessType: ATTENDANCE_REQUIRED)
    const resLegacy = await app.inject({
      method: 'GET',
      url: `/api/v1/access/lessons/${legacyAttendanceLessonId}/access`,
      headers: { authorization: `Bearer ${localStudentToken}` }
    });
    expect(resLegacy.statusCode).toBe(200);
    expect(resLegacy.json().data.allowed).toBe(true);
  });

  // TEST 3: ACTIVE subscription + attendanceRequired = true + NO attendance record -> allowed
  it('Test 3: Student with active subscription and no physical attendance record is allowed online access', async () => {
    // Delete physical attendance record
    await prisma.attendance.deleteMany({
      where: { sessionId: saturdaySessionId, studentId: localStudentId }
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/access/lessons/${paidLessonId}/access`,
      headers: { authorization: `Bearer ${localStudentToken}` }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.allowed).toBe(true);
  });

  // TEST 4: EXPIRED subscription + attendanceRequired = true + Saturday PRESENT -> denied
  it('Test 4: Student with EXPIRED subscription is denied online access even if they attended Saturday (PRESENT)', async () => {
    // Expire the local student's subscription
    await prisma.subscription.updateMany({
      where: { studentId: localStudentId },
      data: {
        status: 'EXPIRED',
        currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    });

    // Mark Saturday attendance = PRESENT
    await prisma.attendance.create({
      data: {
        sessionId: saturdaySessionId,
        studentId: localStudentId,
        status: AttendanceStatus.PRESENT
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/access/lessons/${paidLessonId}/access`,
      headers: { authorization: `Bearer ${localStudentToken}` }
    });
    expect(res.statusCode).toBe(200);
    const decision = res.json().data;
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('SUBSCRIPTION_REQUIRED');
  });

  // TEST 5: NO subscription + attendanceRequired = false -> subscription-required lesson denied
  it('Test 5: Online student with no subscription is denied subscription-required lesson access', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/access/lessons/${paidLessonId}/access`,
      headers: { authorization: `Bearer ${onlineStudentToken}` }
    });
    expect(res.statusCode).toBe(200);
    const decision = res.json().data;
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('SUBSCRIPTION_REQUIRED');
  });

  // TEST 6: FREE lessons remain accessible without subscription
  it('Test 6: FREE lesson is accessible to students with no active subscription', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/access/lessons/${freeLessonId}/access`,
      headers: { authorization: `Bearer ${onlineStudentToken}` }
    });
    expect(res.statusCode).toBe(200);
    const decision = res.json().data;
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('FREE_PREVIEW');
    expect(decision.isFreePreview).toBe(true);
  });

  // TEST 7: EducationalAccessGrant still works
  it('Test 7: EducationalAccessGrant unlocks paid lesson without subscription', async () => {
    // Admin creates grant for online student
    const grantRes = await app.inject({
      method: 'POST',
      url: '/api/v1/access/grants',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        studentId: onlineStudentId,
        scope: AccessGrantScope.LESSON,
        lessonId: paidLessonId,
        reason: 'Special talent scholarship'
      }
    });
    expect(grantRes.statusCode).toBe(201);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/access/lessons/${paidLessonId}/access`,
      headers: { authorization: `Bearer ${onlineStudentToken}` }
    });
    expect(res.statusCode).toBe(200);
    const decision = res.json().data;
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('ADMIN_GRANTED');
  });

  // TEST 8: Admin access still works
  it('Test 8: Admin has universal access to all lessons', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/access/lessons/${paidLessonId}/access`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(res.statusCode).toBe(200);
    const decision = res.json().data;
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('ADMIN_GRANTED');
  });

  // TEST 9: Video playback authorization follows the same rule and cannot accidentally reintroduce attendance gating
  it('Test 9: Video playback authorization strictly enforces online entitlement and rejects unauthorized requests', async () => {
    // Unsubscribe online student from the grant
    await prisma.educationalAccessGrant.updateMany({
      where: { studentId: onlineStudentId },
      data: { isActive: false }
    });

    // Attempt video playback without subscription -> 403 Forbidden
    const deniedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/lessons/${paidLessonId}/playback`,
      headers: { authorization: `Bearer ${onlineStudentToken}` }
    });
    expect(deniedRes.statusCode).toBe(403);

    // Give online student active subscription
    await prisma.subscription.create({
      data: {
        studentId: onlineStudentId,
        planId,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    // Attempt video playback with active subscription -> 200 OK
    const allowedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/lessons/${paidLessonId}/playback`,
      headers: { authorization: `Bearer ${onlineStudentToken}` }
    });
    expect(allowedRes.statusCode).toBe(200);
  });
});
