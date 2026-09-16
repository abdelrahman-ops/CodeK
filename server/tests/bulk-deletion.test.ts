import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, loginAdmin, loginStudent } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';

describe('Admin Bulk Deletion API Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);
    studentToken = await loginStudent(app);
  });

  // ---------------------------------------------------------------------------
  // 1. SESSIONS BULK DELETE
  // ---------------------------------------------------------------------------
  describe('DELETE /api/v1/sessions/bulk', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/bulk',
        payload: { ids: ['00000000-0000-0000-0000-000000000001'] }
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject non-admin users with 403', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/bulk',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { ids: ['00000000-0000-0000-0000-000000000001'] }
      });
      expect(res.statusCode).toBe(403);
    });

    it('should reject empty or invalid ids array with 400', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/bulk',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { ids: [] }
      });
      expect(res.statusCode).toBe(400);
    });

    it('should successfully bulk delete sessions and associated attendance', async () => {
      // Find a group or create one for test sessions
      let testGroup = await prisma.group.findFirst();
      if (!testGroup) {
        testGroup = await prisma.group.create({
          data: {
            name: 'Bulk Delete Session Group',
            yearGroup: 'G11',
            term: 'FIRST_TERM',
            maxCapacity: 30
          }
        });
      }

      // Create 2 test sessions
      const s1 = await prisma.session.create({
        data: {
          groupId: testGroup.id,
          sessionNumber: 991,
          date: new Date(),
          startTime: '10:00',
          endTime: '11:00',
          status: 'SCHEDULED'
        }
      });
      const s2 = await prisma.session.create({
        data: {
          groupId: testGroup.id,
          sessionNumber: 992,
          date: new Date(),
          startTime: '11:00',
          endTime: '12:00',
          status: 'SCHEDULED'
        }
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/bulk',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { ids: [s1.id, s2.id] }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.deletedCount).toBe(2);

      // Verify deletion in DB
      const check = await prisma.session.findMany({
        where: { id: { in: [s1.id, s2.id] } }
      });
      expect(check.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. GROUPS BULK DELETE & PARTIAL FAILURES
  // ---------------------------------------------------------------------------
  describe('DELETE /api/v1/groups/bulk', () => {
    it('should reject non-admin users with 403', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/groups/bulk',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { ids: ['00000000-0000-0000-0000-000000000001'] }
      });
      expect(res.statusCode).toBe(403);
    });

    it('should safely handle partial failure when group has active students or sessions', async () => {
      const timestamp = Date.now();
      // Create empty group that CAN be deleted
      const emptyGroup = await prisma.group.create({
        data: {
          name: `Deletable Test Group ${timestamp}`,
          description: 'A temporary test group',
          maxCapacity: 20
        }
      });

      // Create group with active session that CANNOT be deleted
      const busyGroup = await prisma.group.create({
        data: {
          name: `Protected Busy Group ${timestamp}`,
          description: 'A protected test group',
          maxCapacity: 20
        }
      });

      const busySession = await prisma.session.create({
        data: {
          groupId: busyGroup.id,
          sessionNumber: 999,
          date: new Date(),
          startTime: '14:00',
          endTime: '15:00',
          status: 'SCHEDULED'
        }
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/groups/bulk',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { ids: [emptyGroup.id, busyGroup.id] }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.deletedCount).toBe(1);
      expect(data.failedCount).toBe(1);
      expect(data.failed).toHaveLength(1);
      expect(data.failed[0].id).toBe(busyGroup.id);
      expect(data.failed[0].reason).toContain('sessions');

      // Verify emptyGroup is deleted
      const checkEmpty = await prisma.group.findUnique({ where: { id: emptyGroup.id } });
      expect(checkEmpty).toBeNull();

      // Verify busyGroup is preserved
      const checkBusy = await prisma.group.findUnique({ where: { id: busyGroup.id } });
      expect(checkBusy).not.toBeNull();

      // Cleanup
      await prisma.session.delete({ where: { id: busySession.id } });
      await prisma.group.delete({ where: { id: busyGroup.id } });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. CURRICULUM BULK DELETE & OFFICIAL PROTECTION
  // ---------------------------------------------------------------------------
  describe('DELETE /api/v1/curriculum/bulk', () => {
    it('should strictly protect the official curriculum from bulk deletion', async () => {
      const official = await prisma.curriculum.findFirst({
        where: { code: 'G11-T1-EB-2026' }
      });

      expect(official).not.toBeNull();
      if (!official) return;

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/curriculum/bulk',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { ids: [official.id] }
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error?.message || body.message).toContain('official curriculum');

      // Verify official curriculum is still in DB
      const checkOfficial = await prisma.curriculum.findUnique({
        where: { id: official.id }
      });
      expect(checkOfficial).not.toBeNull();
    });

    it('should delete non-official curriculum and cleanly cascade all child relations', async () => {
      const timestamp = Date.now();
      // Create a test curriculum
      const testCurr = await prisma.curriculum.create({
        data: {
          code: `TEST-BULK-${timestamp}`,
          title: 'Temporary Curriculum for Bulk Delete Test',
          academicYear: '2025/2026',
          term: 'TERM_1',
          authority: 'PROPOSED'
        }
      });

      // Create section
      const testSection = await prisma.section.create({
        data: {
          curriculumId: testCurr.id,
          title: 'Test Section 1',
          order: 1
        }
      });

      // Create lesson
      const testLesson = await prisma.lesson.create({
        data: {
          curriculumId: testCurr.id,
          sectionId: testSection.id,
          title: 'Test Lesson 1',
          content: '# Test Lesson Content',
          order: 1
        }
      });

      // Create task
      const testTask = await prisma.task.create({
        data: {
          lesson: { connect: { id: testLesson.id } },
          title: 'Test Task 1',
          description: 'Task Description',
          instructions: 'Task Instructions',
          xpReward: 10
        }
      });

      // Create exam linked to this test curriculum and lesson
      const testExam = await prisma.exam.create({
        data: {
          title: 'Test Quiz for Bulk Del',
          curriculum: { connect: { id: testCurr.id } },
          lesson: { connect: { id: testLesson.id } },
          isQuiz: true,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 3600000),
          durationMinutes: 15,
          totalMarks: 10,
          questions: {
            create: [
              {
                questionText: 'Test Question 1?',
                marks: 10,
                order: 1,
                options: JSON.stringify(['A', 'B', 'C', 'D']),
                correctAnswer: 'A'
              }
            ]
          }
        }
      });

      const lessonId = testLesson.id;
      const taskId = testTask.id;


      // Call bulk delete
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/curriculum/bulk',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { ids: [testCurr.id] }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.deletedCount).toBe(1);

      // Verify no orphaned records remain
      const checkCurr = await prisma.curriculum.findUnique({ where: { id: testCurr.id } });
      const checkLesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
      const checkTask = await prisma.task.findUnique({ where: { id: taskId } });
      const checkExam = await prisma.exam.findUnique({ where: { id: testExam.id } });

      expect(checkCurr).toBeNull();
      expect(checkLesson).toBeNull();
      expect(checkTask).toBeNull();
      expect(checkExam).toBeNull();
    });
  });
});
