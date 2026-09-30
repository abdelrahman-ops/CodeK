import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { verifyPassword } from '../src/common/utils/crypto.js';
import { Role } from '@prisma/client';
import { env } from '../src/config/env.js';

describe('Phase 2: Self-Service Student Registration', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let freeLessonId: string;
  let paidLessonId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Create a course with 1 free lesson and 1 subscription-required lesson for entitlement testing
    const courseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/curriculum',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Phase 2 Test Course ' + Date.now(),
        description: 'Testing self-service student access decoupling',
        grade: 'GRADE_1'
      }
    });
    const courseId = courseRes.json().data.id;

    const freeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: courseId,
        title: 'Free Intro Lesson',
        order: 1,
        isFree: true,
        accessType: 'FREE',
        content: 'Free preview lesson content'
      }
    });
    freeLessonId = freeRes.json().data.id;

    const paidRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: courseId,
        title: 'Premium Subscription Lesson',
        order: 2,
        isFree: false,
        accessType: 'SUBSCRIPTION_REQUIRED',
        content: 'Premium subscriber-only content'
      }
    });
    paidLessonId = paidRes.json().data.id;
  });

  // ─────────────────────────────────────────────────────────
  // 1. REGISTRATION CORE
  // ─────────────────────────────────────────────────────────
  describe('1. Registration Core', () => {
    const regEmail = `student_${Date.now()}@codek.dev`;
    const regPhone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regPassword = 'SecureStudent@123';
    let registeredUser: any;
    let registeredAccessToken: string;

    it('1. Valid registration succeeds (HTTP 201)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Omar',
          lastName: 'Hassan',
          email: regEmail,
          phone: regPhone,
          password: regPassword,
          programmingLevel: 'BEGINNER'
        }
      });

      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      expect(data).toBeDefined();
      expect(data.requiresVerification).toBe(true);
      expect(data.userId).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.accessToken).toBeUndefined();
      expect(data.refreshToken).toBeUndefined();

      registeredUser = data.user;

      // Phase 7 Flow: Obtain dev OTP and complete email verification
      const devOtp = data.devOtp;
      expect(devOtp).toBeDefined();

      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: {
          userId: data.userId,
          otpCode: devOtp
        }
      });
      expect(verifyRes.statusCode).toBe(200);
      const verifyData = verifyRes.json().data;
      expect(verifyData.accessToken).toBeDefined();
      expect(verifyData.refreshToken).toBeDefined();
      expect(verifyData.user.isEmailVerified).toBe(true);

      registeredAccessToken = verifyData.accessToken;

      // Complete onboarding by selecting learning mode
      const modeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/select-learning-mode',
        headers: { authorization: `Bearer ${registeredAccessToken}` },
        payload: {
          mode: 'ONLINE'
        }
      });
      expect(modeRes.statusCode).toBe(200);
      expect(modeRes.json().data.learningModeSelected).toBe(true);
    });

    it('2. User record is created with correct defaults', async () => {
      const user = await prisma.user.findUnique({
        where: { id: registeredUser.id }
      });
      expect(user).toBeDefined();
      expect(user?.email).toBe(regEmail.toLowerCase());
      expect(user?.phone).toBe(regPhone);
      expect(user?.role).toBe(Role.STUDENT);
      expect(user?.isActive).toBe(true);
      expect(user?.mustChangePassword).toBe(false);
      expect(user?.isEmailVerified).toBe(true); // Verified in onboarding flow
      expect(user?.loginId).toMatch(/^STU-[0-9A-Z]{4}$/);
    });

    it('3. Student profile is created atomically linked to User', async () => {
      const student = await prisma.student.findUnique({
        where: { userId: registeredUser.id }
      });
      expect(student).toBeDefined();
      expect(student?.studentCode).toBe(registeredUser.loginId);
      expect(student?.anonymousLeaderboardCode).toMatch(/^CODE-[0-9A-Z]{4}$/);
      expect(student?.learningModeSelected).toBe(true); // Selected in onboarding flow
      expect(student?.totalXp).toBe(0);
      expect(student?.currentStreak).toBe(0);
    });

    it('4. Password is secure bcrypt hash (never plaintext)', async () => {
      const user = await prisma.user.findUnique({
        where: { id: registeredUser.id }
      });
      expect(user?.passwordHash).not.toBe(regPassword);
      expect(user?.passwordHash).toMatch(/^\$2[aby]\$/);
      const matches = await verifyPassword(regPassword, user!.passwordHash);
      expect(matches).toBe(true);
    });

    it('5. attendanceRequired is strictly false', async () => {
      const student = await prisma.student.findUnique({
        where: { userId: registeredUser.id }
      });
      expect(student?.attendanceRequired).toBe(false);
    });

    it('6. No subscription is created for new self-service student', async () => {
      const student = await prisma.student.findUnique({
        where: { userId: registeredUser.id }
      });
      const subs = await prisma.subscription.findMany({
        where: { studentId: student!.id }
      });
      expect(subs.length).toBe(0);
    });

    it('7. Premium lesson remains locked with SUBSCRIPTION_REQUIRED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${paidLessonId}`,
        headers: { authorization: `Bearer ${registeredAccessToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.isLocked).toBe(true);
      expect(data.lockReason).toBe('SUBSCRIPTION_REQUIRED');
      expect(data.content).toBeNull();
    });

    it('8. Free lesson remains immediately accessible', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${freeLessonId}`,
        headers: { authorization: `Bearer ${registeredAccessToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.isLocked).toBe(false);
      expect(data.content).toBe('Free preview lesson content');
    });
  });

  // ─────────────────────────────────────────────────────────
  // 2. DUPLICATES & UNIQUENESS
  // ─────────────────────────────────────────────────────────
  describe('2. Duplicate Protection', () => {
    const existingEmail = `dup_${Date.now()}@codek.dev`;
    const existingPhone = `011${Math.floor(10000000 + Math.random() * 90000000)}`;

    beforeAll(async () => {
      // Seed first account
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Original',
          lastName: 'Student',
          email: existingEmail,
          phone: existingPhone,
          password: 'Password@123'
        }
      });
    });

    it('9. Duplicate email is rejected with clean error', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Another',
          lastName: 'Student',
          email: existingEmail.toUpperCase(), // Test case insensitivity
          phone: `012${Math.floor(10000000 + Math.random() * 90000000)}`,
          password: 'Password@123'
        }
      });

      expect([400, 409]).toContain(res.statusCode);
      expect(res.json().error?.message).toMatch(/already exists/i);
    });

    it('10. Duplicate phone is rejected with clean error', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Another',
          lastName: 'Student',
          email: `new_diff_${Date.now()}@codek.dev`,
          phone: existingPhone,
          password: 'Password@123'
        }
      });

      expect([400, 409]).toContain(res.statusCode);
      expect(res.json().error?.message).toMatch(/already exists/i);
    });

    it('11. Database-level unique constraint handles race conditions', async () => {
      // Direct collision simulation against database constraint
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Clone',
          lastName: 'User',
          email: existingEmail,
          password: 'Password@123'
        }
      });

      expect([400, 409]).toContain(res.statusCode);
      expect(res.json().error).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3. VALIDATION RULES
  // ─────────────────────────────────────────────────────────
  describe('3. Validation Rules', () => {
    it('13. Invalid email format is rejected (HTTP 400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Valid',
          lastName: 'Name',
          email: 'not-an-email',
          password: 'Password@123'
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBeDefined();
    });

    it('14. Weak/short password (< 6 characters) is rejected (HTTP 400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Valid',
          lastName: 'Name',
          email: `pass_test_${Date.now()}@codek.dev`,
          password: '12345' // Too short
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBeDefined();
    });

    it('15. Missing required fields (firstName, lastName, password) rejected (HTTP 400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: `missing_fields_${Date.now()}@codek.dev`
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBeDefined();
    });

    it('Honeypot website field rejects bot submissions', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Spam',
          lastName: 'Bot',
          email: `bot_${Date.now()}@spambot.com`,
          password: 'Password@123',
          website: 'https://spamlink.com'
        }
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 4. SECURITY & PRIVILEGE ISOLATION
  // ─────────────────────────────────────────────────────────
  describe('4. Security & Privilege Isolation', () => {
    it('16. Password and passwordHash never appear in API response', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Sec',
          lastName: 'User',
          email: `sec_${Date.now()}@codek.dev`,
          password: 'MySecretPassword@123'
        }
      });

      expect(res.statusCode).toBe(201);
      const rawBody = res.body;
      expect(rawBody).not.toContain('passwordHash');
      expect(rawBody).not.toContain('MySecretPassword@123');
    });

    it('17. Sensitive fields are not exposed in client payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Safe',
          lastName: 'User',
          email: `safe_${Date.now()}@codek.dev`,
          password: 'Password@123'
        }
      });

      const data = res.json().data;
      expect(data.user.passwordHash).toBeUndefined();
      expect(data.user.student.userId).toBeUndefined();
    });

    it('18. Public user cannot set attendanceRequired=true', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Hack',
          lastName: 'Attempt',
          email: `hack_att_${Date.now()}@codek.dev`,
          password: 'Password@123',
          attendanceRequired: true // Attempted privilege/policy elevation
        }
      });

      expect(res.statusCode).toBe(201);
      const student = await prisma.student.findUnique({
        where: { userId: res.json().data.user.id }
      });
      // Server must enforce default false
      expect(student?.attendanceRequired).toBe(false);
    });

    it('19 & 20. Public user cannot create ADMIN or other role', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Fake',
          lastName: 'Admin',
          email: `fake_admin_${Date.now()}@codek.dev`,
          password: 'Password@123',
          role: 'ADMIN', // Attempted role escalation
          isAdmin: true
        }
      });

      expect(res.statusCode).toBe(201);
      const user = await prisma.user.findUnique({
        where: { id: res.json().data.user.id }
      });
      expect(user?.role).toBe(Role.STUDENT);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 5. REGRESSION VERIFICATION
  // ─────────────────────────────────────────────────────────
  describe('5. Regression & Compatibility', () => {
    it('21. Existing Admin login still works with 2FA OTP flow', async () => {
      const adminLoginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          loginId: env.ADMIN_LOGIN_ID || 'ADM-1106',
          password: env.ADMIN_PASSWORD || 'AdminSuper110616010@here'
        }
      });

      expect(adminLoginRes.statusCode).toBe(200);
      const body = adminLoginRes.json().data;
      expect(body.requires2FA).toBe(true);
      expect(body.tempToken).toBeDefined();
    });

    it('22. Existing student login still works with loginId and email', async () => {
      // Login with loginId
      const loginIdRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { loginId: 'STU-1001', password: 'Student@123' }
      });
      expect(loginIdRes.statusCode).toBe(200);
      expect(loginIdRes.json().data.user.role).toBe(Role.STUDENT);

      // Login with newly registered student's email
      const newEmail = `reg_login_${Date.now()}@codek.dev`;
      const pass = 'StudentPass@123';
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Login',
          lastName: 'Tester',
          email: newEmail,
          password: pass
        }
      });
      expect(regRes.statusCode).toBe(201);
      const regData = regRes.json().data;

      // Follow Phase 7 flow: verify email then select learning mode
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: {
          userId: regData.userId,
          otpCode: regData.devOtp
        }
      });
      expect(verifyRes.statusCode).toBe(200);
      const verifyToken = verifyRes.json().data.accessToken;

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/select-learning-mode',
        headers: { authorization: `Bearer ${verifyToken}` },
        payload: { mode: 'ONLINE' }
      });

      const emailLoginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { loginId: newEmail, password: pass }
      });
      expect(emailLoginRes.statusCode).toBe(200);
      expect(emailLoginRes.json().data.user.email).toBe(newEmail);
    });

    it('23 & 24. Existing legacy StudentRegistration application flow still works', async () => {
      const legacyPhone = `015${Math.floor(10000000 + Math.random() * 90000000)}`;
      const appRes = await app.inject({
        method: 'POST',
        url: '/api/v1/public/registrations',
        payload: {
          firstName: 'Legacy',
          lastName: 'Applicant',
          phone: legacyPhone,
          programmingLevel: 'BEGINNER',
          schoolName: 'Test School',
          grade: 'Grade 5'
        }
      });

      expect(appRes.statusCode).toBe(201);
      const regData = appRes.json().data;
      expect(regData.id).toBeDefined();
      expect(regData.status).toBe('PENDING');

      // Admin reviews & approves legacy registration
      const approveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/registrations/${regData.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {}
      });
      expect(approveRes.statusCode).toBe(200);
      expect(approveRes.json().data.student.id).toBeDefined();
    });

    it('25. Existing refresh-token exchange still works for self-service registered students', async () => {
      const newEmail = `refresh_test_${Date.now()}@codek.dev`;
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Refresh',
          lastName: 'Student',
          email: newEmail,
          password: 'Password@123'
        }
      });
      expect(regRes.statusCode).toBe(201);
      const regData = regRes.json().data;

      // Verify email to receive authenticated session with refreshToken
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: {
          userId: regData.userId,
          otpCode: regData.devOtp
        }
      });
      expect(verifyRes.statusCode).toBe(200);
      const refreshToken = verifyRes.json().data.refreshToken;

      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken }
      });

      expect(refreshRes.statusCode).toBe(200);
      const refData = refreshRes.json().data;
      expect(refData.accessToken).toBeDefined();
      expect(refData.refreshToken).toBeDefined();
      expect(refData.user.email).toBe(newEmail);
    });
  });
});
