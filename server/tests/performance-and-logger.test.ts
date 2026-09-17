import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sanitizeUrl, sanitizeErrorMessage, isSensitiveParam } from '../src/plugins/request-logger.js';
import { getPaymentSummary } from '../src/modules/payments/payment.service.js';
import { getTodayScheduledGroups, getNextSessionNumber } from '../src/modules/sessions/session.service.js';
import { prisma } from '../src/db/prisma.js';
import { PaymentStatus, Role, SessionStatus, StudentGrade } from '@prisma/client';

describe('Performance, Aggregation & Observability Regression Tests', () => {
  describe('1. Request Logger URL & Error Sanitizer', () => {
    it('redacts all required sensitive query parameters', () => {
      const url = '/api/v1/auth/callback?password=mysecretpass&token=secrettoken123&secret=confidentialval&key=privatekey99&otp=123456&access_token=bearerabc&refresh_token=refreshxyz&authorization=customauth';
      const sanitized = sanitizeUrl(url);

      expect(sanitized).not.toContain('mysecretpass');
      expect(sanitized).not.toContain('secrettoken123');
      expect(sanitized).not.toContain('confidentialval');
      expect(sanitized).not.toContain('privatekey99');
      expect(sanitized).not.toContain('123456');
      expect(sanitized).not.toContain('bearerabc');
      expect(sanitized).not.toContain('refreshxyz');
      expect(sanitized).not.toContain('customauth');

      expect(sanitized).toContain('password=%5BREDACTED%5D');
      expect(sanitized).toContain('token=%5BREDACTED%5D');
      expect(sanitized).toContain('secret=%5BREDACTED%5D');
      expect(sanitized).toContain('key=%5BREDACTED%5D');
      expect(sanitized).toContain('otp=%5BREDACTED%5D');
      expect(sanitized).toContain('access_token=%5BREDACTED%5D');
      expect(sanitized).toContain('refresh_token=%5BREDACTED%5D');
      expect(sanitized).toContain('authorization=%5BREDACTED%5D');
    });

    it('handles URL-encoded delimiters e.g. token%3Dsecret', () => {
      const url = '/api/v1/verify?token%3Dsupersecret123';
      const sanitized = sanitizeUrl(url);

      expect(sanitized).not.toContain('supersecret123');
      expect(sanitized).toContain('token=%5BREDACTED%5D');
    });

    it('preserves safe parameters and normal query strings', () => {
      const url = '/api/v1/curriculum?includeDetails=true&page=2&limit=20';
      const sanitized = sanitizeUrl(url);

      expect(sanitized).toBe('/api/v1/curriculum?includeDetails=true&page=2&limit=20');
    });

    it('handles mixed safe and sensitive parameters correctly', () => {
      const url = '/api/v1/students?search=Ahmed&token=xyz789&groupId=some-uuid';
      const sanitized = sanitizeUrl(url);

      expect(sanitized).toContain('search=Ahmed');
      expect(sanitized).toContain('groupId=some-uuid');
      expect(sanitized).not.toContain('xyz789');
      expect(sanitized).toContain('token=%5BREDACTED%5D');
    });

    it('handles URLs without query strings cleanly', () => {
      expect(sanitizeUrl('/api/v1/dashboard/admin')).toBe('/api/v1/dashboard/admin');
    });

    it('sanitizes sensitive data from error messages', () => {
      const rawError1 = 'Unauthorized: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token123';
      expect(sanitizeErrorMessage(rawError1)).toBe('Unauthorized: Bearer [REDACTED]');

      const rawError2 = 'Database connection failed: postgresql://admin:SuperSecretPass@db.host.internal:5432/main';
      expect(sanitizeErrorMessage(rawError2)).toBe('Database connection failed: postgresql://admin:[REDACTED]@db.host.internal:5432/main');

      const rawError3 = 'Failed to validate query: ?token=mysecretpass&other=ok';
      expect(sanitizeErrorMessage(rawError3)).toBe('Failed to validate query: ?token=[REDACTED]&other=ok');
    });
  });

  describe('2. Payment Summary PostgreSQL Aggregation', () => {
    let testStudentId: string;
    const testYear = 2088;
    const testMonth = 5;

    beforeAll(async () => {
      // Find or create test student
      let student = await prisma.student.findFirst();
      if (!student) {
        const user = await prisma.user.create({
          data: {
            loginId: 'TEST-STU-PERF',
            role: Role.STUDENT,
            firstName: 'Perf',
            lastName: 'Test',
            passwordHash: 'dummy',
            student: {
              create: {
                studentCode: 'TEST-STU-PERF',
                grade: StudentGrade.GRADE_1
              }
            }
          },
          include: { student: true }
        });
        student = user.student!;
      }
      testStudentId = student.id;

      // Seed payments for year 2088 month 5
      await prisma.payment.deleteMany({ where: { year: testYear } });
      await prisma.payment.create({
        data: {
          studentId: testStudentId,
          year: testYear,
          month: testMonth,
          amount: 300,
          status: PaymentStatus.PAID,
          paidAt: new Date()
        }
      });
      await prisma.payment.create({
        data: {
          studentId: testStudentId,
          year: testYear,
          month: testMonth + 1,
          amount: 200,
          status: PaymentStatus.UNPAID
        }
      });
    });

    afterAll(async () => {
      await prisma.payment.deleteMany({ where: { year: testYear } });
    });

    it('returns zero values when no payment records exist for the month', async () => {
      const summary = await getPaymentSummary(2099, 1);

      expect(summary).toEqual({
        year: 2099,
        month: 1,
        totalRecords: 0,
        paidCount: 0,
        unpaidCount: 0,
        totalCollectedEgp: 0,
        totalExpectedEgp: 0
      });
    });

    it('correctly aggregates records by status using database groupBy', async () => {
      const summary = await getPaymentSummary(testYear, testMonth);

      expect(summary.year).toBe(testYear);
      expect(summary.month).toBe(testMonth);
      expect(summary.totalRecords).toBe(1);
      expect(summary.paidCount).toBe(1);
      expect(summary.unpaidCount).toBe(0);
      expect(summary.totalCollectedEgp).toBe(300);
      expect(summary.totalExpectedEgp).toBe(300);
    });
  });

  describe('3. Batched getTodayScheduledGroups & Next Session Number', () => {
    let testGroupId1: string;
    let testGroupId2: string;
    let testGroupId3: string;

    beforeAll(async () => {
      // Group 1: 0 sessions
      const g1 = await prisma.group.create({
        data: {
          name: 'PERF_TEST_GRP_0_SESSIONS',
          maxCapacity: 10
        }
      });
      testGroupId1 = g1.id;

      // Group 2: 2 sessions (numbers 1 and 2)
      const g2 = await prisma.group.create({
        data: {
          name: 'PERF_TEST_GRP_2_SESSIONS',
          maxCapacity: 10
        }
      });
      testGroupId2 = g2.id;
      await prisma.session.create({
        data: {
          groupId: testGroupId2,
          sessionNumber: 1,
          date: new Date(),
          startTime: '10:00',
          endTime: '11:00',
          status: SessionStatus.COMPLETED
        }
      });
      await prisma.session.create({
        data: {
          groupId: testGroupId2,
          sessionNumber: 2,
          date: new Date(),
          startTime: '11:00',
          endTime: '12:00',
          status: SessionStatus.SCHEDULED
        }
      });

      // Group 3: 1 CANCELLED session (number 1)
      const g3 = await prisma.group.create({
        data: {
          name: 'PERF_TEST_GRP_CANCELLED_SESSION',
          maxCapacity: 10
        }
      });
      testGroupId3 = g3.id;
      await prisma.session.create({
        data: {
          groupId: testGroupId3,
          sessionNumber: 1,
          date: new Date(),
          startTime: '12:00',
          endTime: '13:00',
          status: SessionStatus.CANCELLED
        }
      });
    });

    afterAll(async () => {
      const ids = [testGroupId1, testGroupId2, testGroupId3].filter(Boolean);
      if (ids.length > 0) {
        await prisma.session.deleteMany({ where: { groupId: { in: ids } } });
        await prisma.group.deleteMany({ where: { id: { in: ids } } });
      }
    });

    it('verifies nextSessionNumber for 0 sessions, multiple sessions, and cancelled sessions', async () => {
      // Group 1: 0 sessions -> next should be 1
      const next1 = await getNextSessionNumber(testGroupId1);
      expect(next1).toBe(1);

      // Group 2: sessions 1 and 2 -> next should be 3
      const next2 = await getNextSessionNumber(testGroupId2);
      expect(next2).toBe(3);

      // Group 3: session 1 cancelled -> next should be 2
      const next3 = await getNextSessionNumber(testGroupId3);
      expect(next3).toBe(2);

      // Verify set-based groupBy behaves identically to sequential getNextSessionNumber
      const groupIds = [testGroupId1, testGroupId2, testGroupId3];
      const maxSessions = await prisma.session.groupBy({
        by: ['groupId'],
        _max: { sessionNumber: true },
        where: { groupId: { in: groupIds } }
      });
      const map = new Map(maxSessions.map((m) => [m.groupId, m._max.sessionNumber ?? 0]));

      expect((map.get(testGroupId1) ?? 0) + 1).toBe(next1);
      expect((map.get(testGroupId2) ?? 0) + 1).toBe(next2);
      expect((map.get(testGroupId3) ?? 0) + 1).toBe(next3);
    });

    it('executes set-based getTodayScheduledGroups without N+1 queries', async () => {
      const scheduledGroups = await getTodayScheduledGroups();
      expect(Array.isArray(scheduledGroups)).toBe(true);

      for (const group of scheduledGroups) {
        expect(group).toHaveProperty('groupId');
        expect(group).toHaveProperty('groupName');
        expect(group).toHaveProperty('nextSessionNumber');
        expect(typeof group.nextSessionNumber).toBe('number');
        expect(group.nextSessionNumber).toBeGreaterThanOrEqual(1);

        // Verify that nextSessionNumber computed in batch matches single getNextSessionNumber
        const singleNumber = await getNextSessionNumber(group.groupId);
        expect(group.nextSessionNumber).toBe(singleNumber);
      }
    });
  });
});
