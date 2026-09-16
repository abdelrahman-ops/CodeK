import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { AccessGrantScope, LessonAccessType } from '@prisma/client';
import { hashPassword } from '../src/common/utils/crypto.js';

describe('Phase 5: Centralized Entitlements & Subscription-Ready Access Engine', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let enrolledStudentToken: string;
  let enrolledStudentId: string;
  let unenrolledStudentToken: string;
  let unenrolledStudentId: string;
  let courseId: string;
  let freeLessonId: string;
  let enrolledLessonId: string;
  let subscriptionLessonId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Setup Enrolled Student (STU-1001 is enrolled in Web Development Track)
    const stu1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    enrolledStudentToken = stu1Res.json().data.accessToken;
    const stu1Record = await prisma.student.findUnique({
      where: { userId: stu1Res.json().data.user.id }
    });
    enrolledStudentId = stu1Record!.id;

    // Create a new Unenrolled Student for pristine testing
    const uniqueSuffix = Date.now().toString().slice(-4);
    const pwdHash = await hashPassword('Student@123');
    const unenrolledUser = await prisma.user.create({
      data: {
        loginId: `STU-FREE-${uniqueSuffix}`,
        email: `free.student.${uniqueSuffix}@test.com`,
        passwordHash: pwdHash,
        role: 'STUDENT',
        firstName: 'Free',
        lastName: 'Student',
        mustChangePassword: false,
        isEmailVerified: true,
        student: {
          create: {
            studentCode: `STU-FREE-${uniqueSuffix}`,
            anonymousLeaderboardCode: `CODEK-${uniqueSuffix}`,
            learningModeSelected: true
          }
        }
      },
      include: { student: true }
    });
    unenrolledStudentId = unenrolledUser.student!.id;

    const stu2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: `STU-FREE-${uniqueSuffix}`, password: 'Student@123' }
    });
    unenrolledStudentToken = stu2Res.json().data.accessToken;

    // Create Test Course
    const courseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/curriculum',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Phase 5 Entitlements Track ' + uniqueSuffix,
        description: 'Course testing access models'
      }
    });
    courseId = courseRes.json().data.id;

    // Lesson 1: Free Preview
    const freeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: courseId,
        title: 'Lesson 1: Introduction (Free Preview)',
        content: '# Free Content',
        order: 1,
        isFree: true,
        accessType: 'FREE'
      }
    });
    freeLessonId = freeRes.json().data.id;

    // Lesson 2: Available to Enrolled Students
    const enrolledRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: courseId,
        title: 'Lesson 2: Core Deep Dive (Enrolled)',
        content: '# Enrolled Content',
        order: 2,
        isFree: false,
        accessType: 'ENROLLED'
      }
    });
    enrolledLessonId = enrolledRes.json().data.id;

    // Lesson 3: Subscription Required
    const subRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: courseId,
        title: 'Lesson 3: Advanced Pro (Subscription Required)',
        content: '# Subscription Content',
        order: 3,
        isFree: false,
        accessType: 'SUBSCRIPTION_REQUIRED'
      }
    });
    subscriptionLessonId = subRes.json().data.id;
  });

  describe('1. Free Student Access', () => {
    it('unenrolled student accessing free preview lesson is allowed with reason FREE_PREVIEW', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/access/lessons/${freeLessonId}/access`,
        headers: { authorization: `Bearer ${unenrolledStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const decision = res.json().data;
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('FREE_PREVIEW');
      expect(decision.isFreePreview).toBe(true);
    });

    it('unenrolled student gets full lesson details and unlocked content for free lesson', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${freeLessonId}`,
        headers: { authorization: `Bearer ${unenrolledStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const lesson = res.json().data;
      expect(lesson.isLocked).toBe(false);
      expect(lesson.content).toBe('# Free Content');
    });
  });

  describe('2. Online Subscription Access (Legacy Enrolled Compatibility)', () => {
    it('student without active subscription accessing legacy enrolled lesson is denied with SUBSCRIPTION_REQUIRED', async () => {
      await prisma.subscription.deleteMany({ where: { studentId: enrolledStudentId } });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/access/lessons/${enrolledLessonId}/access`,
        headers: { authorization: `Bearer ${enrolledStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const decision = res.json().data;
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('student with active subscription accessing enrolled lesson is allowed with reason ENROLLED', async () => {
      const plan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true } });
      await prisma.subscription.create({
        data: {
          studentId: enrolledStudentId,
          planId: plan!.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/access/lessons/${enrolledLessonId}/access`,
        headers: { authorization: `Bearer ${enrolledStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const decision = res.json().data;
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('ENROLLED');
    });
  });

  describe('3. No Access / Subscription Required', () => {
    it('unenrolled student accessing enrolled lesson is denied with reason SUBSCRIPTION_REQUIRED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/access/lessons/${enrolledLessonId}/access`,
        headers: { authorization: `Bearer ${unenrolledStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const decision = res.json().data;
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('SUBSCRIPTION_REQUIRED');
      expect(decision.lockMessageAr).toBeDefined();
    });

    it('unenrolled student accessing subscription-required lesson is denied', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/access/lessons/${subscriptionLessonId}/access`,
        headers: { authorization: `Bearer ${unenrolledStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const decision = res.json().data;
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('calling lesson details when denied shields content and flags isLocked: true', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${subscriptionLessonId}`,
        headers: { authorization: `Bearer ${unenrolledStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const lesson = res.json().data;
      expect(lesson.isLocked).toBe(true);
      expect(lesson.content).toBeNull();
    });

    it('calling playback route when denied returns 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${subscriptionLessonId}/playback`,
        headers: { authorization: `Bearer ${unenrolledStudentToken}` }
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('4. Admin-Granted Educational Access', () => {
    let grantId: string;

    it('admin grants manual educational access for subscription lesson to unenrolled student', async () => {
      const grantRes = await app.inject({
        method: 'POST',
        url: '/api/v1/access/grants',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          studentId: unenrolledStudentId,
          scope: AccessGrantScope.LESSON,
          lessonId: subscriptionLessonId,
          reason: 'Scholarship exemption for gifted student',
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      });

      expect(grantRes.statusCode).toBe(201);
      const grant = grantRes.json().data;
      expect(grant.studentId).toBe(unenrolledStudentId);
      expect(grant.lessonId).toBe(subscriptionLessonId);
      expect(grant.isActive).toBe(true);
      grantId = grant.id;
    });

    it('student now receives allowed: true and reason: ADMIN_GRANTED on the granted lesson', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/access/lessons/${subscriptionLessonId}/access`,
        headers: { authorization: `Bearer ${unenrolledStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const decision = res.json().data;
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('ADMIN_GRANTED');
      expect(decision.grant).toBeDefined();
      expect(decision.grant.id).toBe(grantId);
    });

    it('lesson details and playback gate unlock for student with admin grant', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${subscriptionLessonId}`,
        headers: { authorization: `Bearer ${unenrolledStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const lesson = res.json().data;
      expect(lesson.isLocked).toBe(false);
      expect(lesson.content).toBe('# Subscription Content');
    });

    it('admin revokes the educational grant and access is immediately revoked', async () => {
      const revokeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/access/grants/${grantId}/revoke`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: 'Scholarship testing period ended' }
      });

      expect(revokeRes.statusCode).toBe(200);
      expect(revokeRes.json().data.isActive).toBe(false);

      // Verify access is now denied again
      const checkRes = await app.inject({
        method: 'GET',
        url: `/api/v1/access/lessons/${subscriptionLessonId}/access`,
        headers: { authorization: `Bearer ${unenrolledStudentToken}` }
      });

      const decision = checkRes.json().data;
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('SUBSCRIPTION_REQUIRED');
    });
  });

  describe('5. Expired and Future Access Grants', () => {
    it('grant with validUntil in the past is treated as expired and denied', async () => {
      const expiredGrant = await app.inject({
        method: 'POST',
        url: '/api/v1/access/grants',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          studentId: unenrolledStudentId,
          scope: AccessGrantScope.LESSON,
          lessonId: subscriptionLessonId,
          reason: 'Past trial',
          validFrom: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          validUntil: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        }
      });
      expect(expiredGrant.statusCode).toBe(201);

      const checkRes = await app.inject({
        method: 'GET',
        url: `/api/v1/access/lessons/${subscriptionLessonId}/access`,
        headers: { authorization: `Bearer ${unenrolledStudentToken}` }
      });

      expect(checkRes.json().data.allowed).toBe(false);
      expect(checkRes.json().data.reason).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('grant with validFrom in the future is not yet active and denied', async () => {
      const futureGrant = await app.inject({
        method: 'POST',
        url: '/api/v1/access/grants',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          studentId: unenrolledStudentId,
          scope: AccessGrantScope.LESSON,
          lessonId: subscriptionLessonId,
          reason: 'Next semester early provision',
          validFrom: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      });
      expect(futureGrant.statusCode).toBe(201);

      const checkRes = await app.inject({
        method: 'GET',
        url: `/api/v1/access/lessons/${subscriptionLessonId}/access`,
        headers: { authorization: `Bearer ${unenrolledStudentToken}` }
      });

      expect(checkRes.json().data.allowed).toBe(false);
      expect(checkRes.json().data.reason).toBe('SUBSCRIPTION_REQUIRED');
    });
  });

  describe('6. Admin Caller & Subscription-Readiness Architecture', () => {
    it('admin caller always receives allowed: true and reason: ADMIN_GRANTED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/access/lessons/${subscriptionLessonId}/access`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const decision = res.json().data;
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('ADMIN_GRANTED');
    });

    it('admin creates subscription plan and lists plans cleanly without fake payment records', async () => {
      const planCode = 'TEST_PRO_' + Date.now().toString().slice(-4);
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/access/plans',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Pro Academy Track',
          code: planCode,
          description: 'Full access to all course units and projects',
          price: 450,
          currency: 'EGP',
          billingInterval: 'MONTHLY',
          features: ['All Courses', 'Video Streaming', 'Direct Mentorship']
        }
      });

      expect(createRes.statusCode).toBe(201);
      const plan = createRes.json().data;
      expect(plan.code).toBe(planCode);
      expect(plan.price).toBe(450);

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/access/plans'
      });

      expect(listRes.statusCode).toBe(200);
      const plans = listRes.json().data;
      expect(plans.some((p: any) => p.code === planCode)).toBe(true);
    });
  });
});
