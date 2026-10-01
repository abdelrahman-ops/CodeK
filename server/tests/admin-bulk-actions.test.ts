import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { StudentGrade } from '@prisma/client';

describe('Admin Bulk Operations & Data-Integrity Protection', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);
  });

  describe('Students Bulk Operations', () => {
    it('Bulk status and bulk delete data integrity checks', async () => {
      // Create student A with no history
      const emailA = `clean_student_${Date.now()}@codek.local`;
      const regA = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { firstName: 'Clean', lastName: 'Student', email: emailA, password: 'Password@123' }
      });
      const userIdA = regA.json().data.userId;
      const verifyA = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { userId: userIdA, otpCode: regA.json().data.devOtp }
      });
      const studentIdA = verifyA.json().data.user.student.id;

      // Create student B with a subscription (historical record)
      const emailB = `busy_student_${Date.now()}@codek.local`;
      const regB = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { firstName: 'Busy', lastName: 'Student', email: emailB, password: 'Password@123' }
      });
      const userIdB = regB.json().data.userId;
      const verifyB = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { userId: userIdB, otpCode: regB.json().data.devOtp }
      });
      const studentIdB = verifyB.json().data.user.student.id;

      // Give student B a subscription
      const plan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true } });
      await prisma.subscription.create({
        data: {
          studentId: studentIdB,
          planId: plan!.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      // 1. Bulk deactivate both students
      const bulkStatusRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/students/bulk-status',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          studentIds: [studentIdA, studentIdB],
          isActive: false
        }
      });
      expect(bulkStatusRes.statusCode).toBe(200);

      const userA = await prisma.user.findUnique({ where: { id: userIdA } });
      const userB = await prisma.user.findUnique({ where: { id: userIdB } });
      expect(userA?.isActive).toBe(false);
      expect(userB?.isActive).toBe(false);

      // 2. Bulk delete both students -> student B should be rejected due to subscription history!
      const bulkDelRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/students/bulk',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          studentIds: [studentIdA, studentIdB]
        }
      });

      expect(bulkDelRes.statusCode).toBe(200);
      const delData = bulkDelRes.json().data;
      expect(delData.successful).toContain(studentIdA);
      expect(delData.failed.some((f: any) => f.id === studentIdB)).toBe(true);

      // Verify student B still exists in database
      const stillThere = await prisma.student.findUnique({ where: { id: studentIdB } });
      expect(stillThere).not.toBeNull();
    });
  });

  describe('Registrations Bulk Operations', () => {
    it('Bulk update registration status', async () => {
      // Create 2 test registrations
      const reg1 = await prisma.studentRegistration.create({
        data: {
          registrationCode: `REG_BULK_${Date.now()}_1`,
          firstName: 'RegBulk1',
          lastName: 'Test',
          phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
          status: 'PENDING'
        }
      });

      const reg2 = await prisma.studentRegistration.create({
        data: {
          registrationCode: `REG_BULK_${Date.now()}_2`,
          firstName: 'RegBulk2',
          lastName: 'Test',
          phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
          status: 'PENDING'
        }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/registrations/bulk-status',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          registrationIds: [reg1.id, reg2.id],
          status: 'WAITLISTED'
        }
      });

      expect(res.statusCode).toBe(200);

      const check1 = await prisma.studentRegistration.findUnique({ where: { id: reg1.id } });
      const check2 = await prisma.studentRegistration.findUnique({ where: { id: reg2.id } });
      expect(check1?.status).toBe('WAITLISTED');
      expect(check2?.status).toBe('WAITLISTED');
    });
  });

  describe('Subscription Plans Bulk Operations', () => {
    it('Bulk update plan status (active/inactive)', async () => {
      // Create 2 test plans
      const p1 = await prisma.subscriptionPlan.create({
        data: {
          code: `TEST_PLAN_1_${Date.now()}`,
          name: 'Bulk Plan 1',
          price: 100,
          currency: 'EGP',
          isActive: true
        }
      });
      const p2 = await prisma.subscriptionPlan.create({
        data: {
          code: `TEST_PLAN_2_${Date.now()}`,
          name: 'Bulk Plan 2',
          price: 200,
          currency: 'EGP',
          isActive: true
        }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/billing/admin/plans/bulk-status',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          ids: [p1.id, p2.id],
          isActive: false
        }
      });

      expect(res.statusCode).toBe(200);
      const check1 = await prisma.subscriptionPlan.findUnique({ where: { id: p1.id } });
      const check2 = await prisma.subscriptionPlan.findUnique({ where: { id: p2.id } });
      expect(check1?.isActive).toBe(false);
      expect(check2?.isActive).toBe(false);

      // Clean up
      await prisma.subscriptionPlan.deleteMany({ where: { id: { in: [p1.id, p2.id] } } });
    });
  });

  describe('Center Payments Bulk Operations', () => {
    it('Bulk update payment status (PAID/UNPAID)', async () => {
      // Find or create student
      const student = await prisma.student.findFirst();
      const p1 = await prisma.payment.create({
        data: {
          studentId: student!.id,
          year: 2026,
          month: 11,
          amount: 250,
          status: 'UNPAID'
        }
      });
      const p2 = await prisma.payment.create({
        data: {
          studentId: student!.id,
          year: 2026,
          month: 12,
          amount: 250,
          status: 'UNPAID'
        }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/payments/bulk-status',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          paymentIds: [p1.id, p2.id],
          status: 'PAID',
          notes: 'سداد جماعي نقدي بالمركز'
        }
      });

      expect(res.statusCode).toBe(200);
      const check1 = await prisma.payment.findUnique({ where: { id: p1.id } });
      const check2 = await prisma.payment.findUnique({ where: { id: p2.id } });
      expect(check1?.status).toBe('PAID');
      expect(check2?.status).toBe('PAID');
      expect(check1?.notes).toBe('سداد جماعي نقدي بالمركز');

      // Clean up
      await prisma.payment.deleteMany({ where: { id: { in: [p1.id, p2.id] } } });
    });
  });

  describe('Curriculum Sections and Lessons Bulk Operations', () => {
    it('Bulk publish lessons and bulk delete protection for official curriculum', async () => {
      // Create non-official curriculum
      const customCurriculum = await prisma.curriculum.create({
        data: {
          title: `Custom Track ${Date.now()}`,
          isPublished: true,
          authority: 'DERIVED',
          grade: StudentGrade.GRADE_2
        }
      });

      const sec = await prisma.section.create({
        data: {
          curriculumId: customCurriculum.id,
          title: 'Custom Section',
          isPublished: true
        }
      });

      const l1 = await prisma.lesson.create({
        data: {
          curriculumId: customCurriculum.id,
          sectionId: sec.id,
          title: 'Lesson Bulk 1',
          content: 'Content 1',
          isPublished: true,
          authority: 'DERIVED'
        }
      });

      const l2 = await prisma.lesson.create({
        data: {
          curriculumId: customCurriculum.id,
          sectionId: sec.id,
          title: 'Lesson Bulk 2',
          content: 'Content 2',
          isPublished: true,
          authority: 'DERIVED'
        }
      });

      // 1. Bulk unpublish lessons
      const unpubRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/lessons/bulk-publish',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { ids: [l1.id, l2.id], isPublished: false }
      });
      expect(unpubRes.statusCode).toBe(200);

      const checkL1 = await prisma.lesson.findUnique({ where: { id: l1.id } });
      expect(checkL1?.isPublished).toBe(false);

      // 2. Safe bulk delete custom lessons
      const delRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/lessons/bulk',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { ids: [l1.id, l2.id] }
      });
      expect(delRes.statusCode).toBe(200);
      expect(delRes.json().data.successful).toHaveLength(2);

      // 3. Test protection on official lesson
      const officialLesson = await prisma.lesson.findFirst({
        where: { authority: 'OFFICIAL' }
      });
      if (officialLesson) {
        const offDelRes = await app.inject({
          method: 'DELETE',
          url: '/api/v1/lessons/bulk',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { ids: [officialLesson.id] }
        });
        expect(offDelRes.statusCode).toBe(200);
        expect(offDelRes.json().data.failed).toHaveLength(1);
        expect(offDelRes.json().data.failed[0].reason).toContain('Official lessons are permanently protected');
      }

      // Clean up custom curriculum
      await prisma.section.delete({ where: { id: sec.id } });
      await prisma.curriculum.delete({ where: { id: customCurriculum.id } });
    });
  });
});
