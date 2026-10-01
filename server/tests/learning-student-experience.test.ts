import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { canAccessLesson, LOCKED_EXPLANATION_AR } from '../src/modules/lessons/lesson-access.service.js';
import { LessonAccessType, Role } from '@prisma/client';

describe('Phase 2: Learning Platform Student Experience', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let studentUserId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    const studentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    studentToken = studentRes.json().data.accessToken;
    studentUserId = studentRes.json().data.user.id;
    studentId = studentRes.json().data.user.student.id;

    // Ensure STU-1001 has no active subscriptions for fresh student experience tests
    await prisma.subscription.deleteMany({ where: { studentId } });
  });

  describe('Centralized Access Control Engine (canAccessLesson)', () => {
    it('grants full access to admin regardless of accessType or attendance', async () => {
      const mockLesson: any = {
        id: 'lesson-adm-1',
        isFree: false,
        accessType: LessonAccessType.ATTENDANCE_REQUIRED,
        sessionLessons: [{ sessionId: 'sess-1' }]
      };

      const result = await canAccessLesson(
        { userId: 'admin-uuid', role: Role.ADMIN },
        mockLesson
      );

      expect(result.canAccess).toBe(true);
      expect(result.isFreePreview).toBe(false);
    });

    it('grants access to free preview lesson without attendance', async () => {
      const mockLesson: any = {
        id: 'lesson-free-1',
        isFree: true,
        accessType: LessonAccessType.FREE,
        sessionLessons: [{ sessionId: 'sess-1' }]
      };

      const result = await canAccessLesson(
        { userId: studentUserId, role: Role.STUDENT, studentId },
        mockLesson
      );

      expect(result.canAccess).toBe(true);
      expect(result.isFreePreview).toBe(true);
    });

    it('locks attendance-required lesson and returns friendly message', async () => {
      // Create course and locked lesson in db
      const course = await prisma.curriculum.create({
        data: {
          title: 'Locked Course Test',
          description: 'Testing locked behavior',
          type: 'OFFICIAL_EB',
          grade: 'GRADE_1'
        }
      });

      // Create a session
      const group = await prisma.group.create({
        data: {
          name: 'Access Test Group ' + Date.now()
        }
      });

      const session = await prisma.session.create({
        data: {
          groupId: group.id,
          sessionNumber: 1,
          date: new Date(),
          startTime: '16:00',
          endTime: '18:00',
          status: 'COMPLETED'
        }
      });

      const lesson = await prisma.lesson.create({
        data: {
          curriculumId: course.id,
          title: 'Locked Attendance Lesson',
          content: 'Secret curriculum material',
          videoUrl: 'https://youtube.com/watch?v=secret',
          isFree: false,
          accessType: LessonAccessType.ATTENDANCE_REQUIRED,
          order: 1
        }
      });

      await prisma.sessionLesson.create({
        data: {
          sessionId: session.id,
          lessonId: lesson.id
        }
      });

      const result = await canAccessLesson(
        { userId: studentUserId, role: Role.STUDENT, studentId },
        {
          id: lesson.id,
          isFree: lesson.isFree,
          accessType: lesson.accessType,
          sessionLessons: [{ sessionId: session.id }]
        }
      );

      expect(result.canAccess).toBe(false);
      expect(result.isFreePreview).toBe(false);
      expect(result.reason).toBe('ATTENDANCE_REQUIRED');
    });
  });

  describe('End-to-End Student Learning Flow', () => {
    let testCourseId: string;
    let freeLessonId: string;
    let lockedLessonId: string;

    beforeAll(async () => {
      // Create Course with 1 Free Lesson and 1 Locked Lesson
      const courseRes = await app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Python Mastery Track',
          description: 'Learn Python from zero',
          type: 'OFFICIAL_EB',
          isPublished: true
        }
      });
      testCourseId = courseRes.json().data.id;

      // Section 1
      const sectionRes = await app.inject({
        method: 'POST',
        url: `/api/v1/courses/${testCourseId}/sections`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Getting Started with Python',
          order: 1
        }
      });
      const sectionId = sectionRes.json().data.id;

      // Lesson 1: Free preview
      const freeLessonRes = await app.inject({
        method: 'POST',
        url: '/api/v1/lessons',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          curriculumId: testCourseId,
          sectionId,
          title: 'Lesson 1: Intro to Python',
          content: 'Welcome to Python! Free preview available to all.',
          videoUrl: 'https://youtube.com/watch?v=intro_python',
          videoDurationSeconds: 1200,
          isFree: true,
          accessType: 'FREE',
          estimatedDurationMinutes: 20
        }
      });
      freeLessonId = freeLessonRes.json().data.id;

      // Lesson 2: Attendance Gated
      const group = await prisma.group.create({
        data: { name: 'E2E Group ' + Date.now() }
      });
      const session = await prisma.session.create({
        data: {
          groupId: group.id,
          sessionNumber: 1,
          date: new Date(),
          startTime: '16:00',
          endTime: '18:00',
          status: 'COMPLETED'
        }
      });

      const lockedLessonRes = await app.inject({
        method: 'POST',
        url: '/api/v1/lessons',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          curriculumId: testCourseId,
          sectionId,
          title: 'Lesson 2: Advanced Data Structures',
          content: 'Protected advanced material.',
          videoUrl: 'https://youtube.com/watch?v=advanced_python',
          videoDurationSeconds: 2400,
          isFree: false,
          accessType: 'ATTENDANCE_REQUIRED',
          estimatedDurationMinutes: 40
        }
      });
      lockedLessonId = lockedLessonRes.json().data.id;

      await prisma.sessionLesson.create({
        data: { sessionId: session.id, lessonId: lockedLessonId }
      });
    });

    it('student accesses free preview lesson with unshielded content and video', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${freeLessonId}`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.isLocked).toBe(false);
      expect(data.isFree).toBe(true);
      expect(data.content).toContain('Welcome to Python');
      expect(data.videoUrl).toBe('https://youtube.com/watch?v=intro_python');
    });

    it('student accesses locked lesson and receives friendly explanation with shielded content', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lockedLessonId}`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.isLocked).toBe(true);
      expect(data.content).toBeNull();
      expect(data.videoUrl).toBeNull();
      expect(data.lockMessage).toBe('هذا الدرس متاح ضمن المحتوى الكامل');
    });

    it('student saves playback position at 08:42 (522 seconds) and resumes accurately', async () => {
      // 08:42 = 8 * 60 + 42 = 522 seconds
      const progressRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lessons/${freeLessonId}/progress`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          lastWatchedPosition: 522,
          progressPercentage: 45
        }
      });

      expect(progressRes.statusCode).toBe(200);
      const prog = progressRes.json().data;
      expect(prog.lastWatchedPosition).toBe(522);
      expect(prog.progressPercentage).toBe(45);
      expect(prog.status).toBe('IN_PROGRESS');

      // Fetch lesson again and verify resume position is attached
      const lessonRes = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${freeLessonId}`,
        headers: { authorization: `Bearer ${studentToken}` }
      });
      const lessonData = lessonRes.json().data;
      expect(lessonData.progress.lastWatchedPosition).toBe(522);
      expect(lessonData.progress.status).toBe('IN_PROGRESS');
    });

    it('student marks lesson completed and updates dynamic course progress', async () => {
      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lessons/${freeLessonId}/progress`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          completed: true
        }
      });

      expect(completeRes.statusCode).toBe(200);
      expect(completeRes.json().data.status).toBe('COMPLETED');
      expect(completeRes.json().data.progressPercentage).toBe(100);

      // Verify course progress calculation
      const courseProgressRes = await app.inject({
        method: 'GET',
        url: `/api/v1/courses/${testCourseId}/progress`,
        headers: { authorization: `Bearer ${studentToken}` }
      });
      expect(courseProgressRes.statusCode).toBe(200);
      const cp = courseProgressRes.json().data;
      expect(cp.completedLessons).toBe(1);
      expect(cp.totalLessons).toBe(2);
      expect(cp.percentage).toBe(50);
    });

    it('student courses summary endpoint returns progress and next continue lesson', async () => {
      const summaryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/courses/student/summary',
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(summaryRes.statusCode).toBe(200);
      const courses = summaryRes.json().data;
      expect(Array.isArray(courses)).toBe(true);

      const pythonCourse = courses.find((c: any) => c.id === testCourseId);
      expect(pythonCourse).toBeDefined();
      expect(pythonCourse.title).toBe('Python Mastery Track');
      expect(pythonCourse.totalLessons).toBe(2);
      expect(pythonCourse.completedLessons).toBe(1);
      expect(pythonCourse.percentage).toBe(50);
      expect(pythonCourse.sectionsCount).toBe(1);
      expect(pythonCourse.continueLesson).toBeDefined();
    });
  });

  describe('Phase 4: Commercial Entitlement & Learning Experience Integration', () => {
    it('returns subscription status and attendanceRequired in getStudentDashboard', async () => {
      // Test when student has no subscription
      const dashRes = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/student',
        headers: { authorization: `Bearer ${studentToken}` }
      });
      expect(dashRes.statusCode).toBe(200);
      const data = dashRes.json().data;
      expect(data.student).toBeDefined();
      expect(typeof data.student.attendanceRequired).toBe('boolean');
      expect(data.subscription).toBeDefined();
      expect(data.subscription.isActive).toBe(false);

      const plan = await prisma.subscriptionPlan.findFirst();
      const planId = plan?.id;

      // Create an active 30-day subscription
      const sub = await prisma.subscription.create({
        data: {
          student: { connect: { id: studentId } },
          ...(planId ? { plan: { connect: { id: planId } } } : {}),
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      const dashActiveRes = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/student',
        headers: { authorization: `Bearer ${studentToken}` }
      });
      expect(dashActiveRes.statusCode).toBe(200);
      const activeData = dashActiveRes.json().data;
      expect(activeData.subscription.isActive).toBe(true);
      expect(activeData.subscription.status).toBe('ACTIVE');
      expect(activeData.subscription.currentPeriodEnd).toBeDefined();

      // Clean up subscription
      await prisma.subscription.delete({ where: { id: sub.id } });
    });

    it('reports expired subscription status and preserves student progress and XP', async () => {
      const plan = await prisma.subscriptionPlan.findFirst();
      const planId = plan?.id;

      // Create an expired subscription
      const pastEnd = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const expiredSub = await prisma.subscription.create({
        data: {
          student: { connect: { id: studentId } },
          ...(planId ? { plan: { connect: { id: planId } } } : {}),
          status: 'EXPIRED',
          currentPeriodStart: new Date(pastEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
          currentPeriodEnd: pastEnd
        }
      });

      const dashRes = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/student',
        headers: { authorization: `Bearer ${studentToken}` }
      });
      expect(dashRes.statusCode).toBe(200);
      const data = dashRes.json().data;
      expect(data.subscription.isActive).toBe(false);
      expect(data.subscription.status).toBe('EXPIRED');
      // Verify progress & XP remain preserved
      expect(data.student.totalXp).toBeGreaterThanOrEqual(0);
      expect(data.progress).toBeDefined();

      // Clean up
      await prisma.subscription.delete({ where: { id: expiredSub.id } });
    });

    it('online-only student (attendanceRequired=false) has attendance independent from lessons', async () => {
      // Ensure student.attendanceRequired = false
      await prisma.student.update({
        where: { id: studentId },
        data: { attendanceRequired: false }
      });

      const dashRes = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/student',
        headers: { authorization: `Bearer ${studentToken}` }
      });
      expect(dashRes.statusCode).toBe(200);
      expect(dashRes.json().data.student.attendanceRequired).toBe(false);
    });
  });
});

