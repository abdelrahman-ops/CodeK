import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin, loginStudent } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';

describe('Learning Platform Foundation Module (Course → Section → Lesson → Progress)', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let studentUserId: string;
  let peerStudentToken: string;
  let peerStudentId: string;

  let createdCourseId: string;
  let createdSection1Id: string;
  let createdSection2Id: string;
  let lockedLessonId: string;
  let freeLessonId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Login Student 1 (Omar - STU-1001)
    const studentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    studentToken = studentRes.json().data.accessToken;
    studentUserId = studentRes.json().data.user.id;
    studentId = studentRes.json().data.user.student.id;

    // Login Student 2 (Youssef - STU-1002) for ownership isolation tests
    const peerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1002', password: 'Student@123' }
    });
    peerStudentToken = peerRes.json().data.accessToken;
    peerStudentId = peerRes.json().data.user.student.id;

    // Ensure both students are assigned GRADE_2 to match the test course curriculum
    await prisma.student.update({
      where: { id: studentId },
      data: { grade: 'GRADE_2' }
    });
    await prisma.student.update({
      where: { id: peerStudentId },
      data: { grade: 'GRADE_2' }
    });
  });

  // 1. Course Creation
  it('1. should allow Admin to create a new Course / Curriculum', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Full Stack Web Development Track',
        description: 'Comprehensive modern web development course',
        type: 'ACADEMY',
        track: 'Web',
        isPublished: true
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.title).toBe('Full Stack Web Development Track');
    createdCourseId = body.data.id;
  });

  // 2. Section Creation
  it('2. should allow Admin to create Sections / Modules within a Course', async () => {
    // Create Section 1: HTML & CSS Basics
    const sec1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${createdCourseId}/sections`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Section 1: HTML & CSS Fundamentals',
        description: 'Core building blocks of the web',
        order: 1,
        isPublished: true
      }
    });

    expect(sec1Res.statusCode).toBe(201);
    createdSection1Id = sec1Res.json().data.id;
    expect(sec1Res.json().data.title).toBe('Section 1: HTML & CSS Fundamentals');

    // Create Section 2: JavaScript Essentials
    const sec2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${createdCourseId}/sections`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Section 2: JavaScript Essentials',
        description: 'Dynamic scripting and DOM manipulation',
        order: 2,
        isPublished: true
      }
    });

    expect(sec2Res.statusCode).toBe(201);
    createdSection2Id = sec2Res.json().data.id;
  });

  // 3. Lesson Creation under Section
  it('3. should allow Admin to create Lessons assigned to a Section', async () => {
    // Create Free Lesson in Section 1
    const freeLessonRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: createdCourseId,
        sectionId: createdSection1Id,
        title: 'Welcome & Introduction to HTML',
        description: 'Overview of tags and page structure',
        content: '<h1>Welcome to HTML</h1><p>HTML is the skeleton of the web.</p>',
        estimatedDurationMinutes: 30,
        order: 1,
        isPublished: true,
        isFree: true, // Preview Lesson!
        videoUrl: 'https://www.youtube.com/watch?v=sample123',
        videoDurationSeconds: 1200
      }
    });

    expect(freeLessonRes.statusCode).toBe(201);
    const freeBody = freeLessonRes.json();
    freeLessonId = freeBody.data.id;
    expect(freeBody.data.isFree).toBe(true);
    expect(freeBody.data.sectionId).toBe(createdSection1Id);

    // Create Attendance-Required Lesson in Section 1
    const lockedLessonRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: createdCourseId,
        sectionId: createdSection1Id,
        title: 'CSS Grid & Modern Flexbox',
        description: 'Advanced responsive layout mechanisms',
        content: '<h1>CSS Grid in Depth</h1><p>Attendance required to view content.</p>',
        estimatedDurationMinutes: 60,
        order: 2,
        isPublished: true,
        isFree: false,
        accessType: 'ATTENDANCE_REQUIRED'
      }
    });

    expect(lockedLessonRes.statusCode).toBe(201);
    lockedLessonId = lockedLessonRes.json().data.id;
    expect(lockedLessonRes.json().data.isFree).toBe(false);
  });

  // 4. Lesson Ordering within Sections
  it('4. should allow Admin to reorder Lessons', async () => {
    const reorderRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons/reorder',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        items: [
          { id: freeLessonId, order: 2, sectionId: createdSection1Id },
          { id: lockedLessonId, order: 1, sectionId: createdSection1Id }
        ]
      }
    });

    expect(reorderRes.statusCode).toBe(200);

    const checkLesson = await prisma.lesson.findUnique({ where: { id: freeLessonId } });
    expect(checkLesson?.order).toBe(2);
  });

  // 5. Publishing / Unpublishing Controls
  it('5. should allow Admin to toggle publishing on Courses, Sections, and Lessons', async () => {
    // Unpublish Section 2
    const unpublishSec = await app.inject({
      method: 'PATCH',
      url: `/api/v1/curriculum/sections/${createdSection2Id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isPublished: false }
    });
    expect(unpublishSec.statusCode).toBe(200);
    expect(unpublishSec.json().data.isPublished).toBe(false);

    // Re-publish Section 2
    const publishSec = await app.inject({
      method: 'PATCH',
      url: `/api/v1/curriculum/sections/${createdSection2Id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isPublished: true }
    });
    expect(publishSec.statusCode).toBe(200);
    expect(publishSec.json().data.isPublished).toBe(true);
  });

  // 6. Preview / Free Lesson Access
  it('6. should allow Student to access Free / Preview Lesson content even without attendance', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/lessons/${freeLessonId}`,
      headers: { authorization: `Bearer ${studentToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.isLocked).toBe(false);
    expect(body.content).toContain('Welcome to HTML');
    expect(body.videoUrl).toBe('https://www.youtube.com/watch?v=sample123');
  });

  // 7. Student Progress Creation
  it('7. should create or initialize Student Lesson Progress as IN_PROGRESS', async () => {
    // Initial progress should be NOT_STARTED
    const initialRes = await app.inject({
      method: 'GET',
      url: `/api/v1/lessons/${freeLessonId}/progress`,
      headers: { authorization: `Bearer ${studentToken}` }
    });
    expect(initialRes.statusCode).toBe(200);
    expect(initialRes.json().data.status).toBe('NOT_STARTED');

    // Student starts lesson
    const startRes = await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${freeLessonId}/progress`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        status: 'IN_PROGRESS',
        progressPercentage: 25,
        lastWatchedPosition: 300 // 5 minutes in
      }
    });

    expect(startRes.statusCode).toBe(200);
    const startBody = startRes.json().data;
    expect(startBody.status).toBe('IN_PROGRESS');
    expect(startBody.progressPercentage).toBe(25);
    expect(startBody.lastWatchedPosition).toBe(300);
    expect(startBody.startedAt).toBeDefined();
  });

  // 8. Student Progress Update
  it('8. should allow updating progress percentage and last watched video position', async () => {
    const updateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${freeLessonId}/progress`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        progressPercentage: 75,
        lastWatchedPosition: 900 // 15 minutes in
      }
    });

    expect(updateRes.statusCode).toBe(200);
    const body = updateRes.json().data;
    expect(body.progressPercentage).toBe(75);
    expect(body.lastWatchedPosition).toBe(900);
    expect(body.status).toBe('IN_PROGRESS');
  });

  // 9. Lesson Completion
  it('9. should mark lesson as COMPLETED and update course progress percentage', async () => {
    const completeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${freeLessonId}/progress`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        completed: true
      }
    });

    expect(completeRes.statusCode).toBe(200);
    const completeBody = completeRes.json().data;
    expect(completeBody.status).toBe('COMPLETED');
    expect(completeBody.progressPercentage).toBe(100);
    expect(completeBody.completedAt).toBeDefined();

    // Verify dynamic Course Progress calculation
    const courseProgressRes = await app.inject({
      method: 'GET',
      url: `/api/v1/courses/${createdCourseId}/progress`,
      headers: { authorization: `Bearer ${studentToken}` }
    });

    expect(courseProgressRes.statusCode).toBe(200);
    const courseData = courseProgressRes.json().data;
    expect(courseData.totalLessons).toBe(2);
    expect(courseData.completedLessons).toBe(1);
    expect(courseData.percentage).toBe(50);
    expect(courseData.status).toBe('IN_PROGRESS');
  });

  // 10. Duplicate Progress Prevention
  it('10. should prevent duplicate progress records per student per lesson via upsert/unique constraint', async () => {
    // Update progress again for the same lesson
    await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${freeLessonId}/progress`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { progressPercentage: 100 }
    });

    const records = await prisma.studentLessonProgress.findMany({
      where: {
        studentId,
        lessonId: freeLessonId
      }
    });

    expect(records.length).toBe(1);
  });

  // 11. Student Ownership Isolation
  it('11. should isolate student progress records between peers', async () => {
    // Peer student has not started this lesson
    const peerProgress = await app.inject({
      method: 'GET',
      url: `/api/v1/lessons/${freeLessonId}/progress`,
      headers: { authorization: `Bearer ${peerStudentToken}` }
    });

    expect(peerProgress.statusCode).toBe(200);
    expect(peerProgress.json().data.status).toBe('NOT_STARTED');
    expect(peerProgress.json().data.progressPercentage).toBe(0);

    // Peer student's course progress should be 0%
    const peerCourse = await app.inject({
      method: 'GET',
      url: `/api/v1/courses/${createdCourseId}/progress`,
      headers: { authorization: `Bearer ${peerStudentToken}` }
    });
    expect(peerCourse.json().data.percentage).toBe(0);
  });

  // 12. Admin CMS Authorization Guards
  it('12. should block non-admins from managing Sections and Course structures', async () => {
    const blockedRes = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${createdCourseId}/sections`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { title: 'Hacked Section' }
    });

    expect(blockedRes.statusCode).toBe(403);
  });

  // 13. Existing Attendance-Gated Lesson Unlocking Verification
  it('13. should keep attendance-gated lesson locked when linked to a session the student did not attend', async () => {
    // Ensure a Group exists
    let group = await prisma.group.findFirst();
    if (!group) {
      group = await prisma.group.create({
        data: { name: 'Test Group LP', maxCapacity: 20 }
      });
    }

    // Create a Session for this Group
    const session = await prisma.session.create({
      data: {
        groupId: group.id,
        sessionNumber: Math.floor(Math.random() * 80000) + 1000,
        date: new Date(),
        startTime: '17:00',
        endTime: '18:30',
        status: 'ACTIVE'
      }
    });

    // Link locked lesson to this session
    await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${lockedLessonId}/link-session`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { sessionId: session.id, order: 1 }
    });

    // Ensure student has an active subscription to test attendance-independent online access
    const plan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true } });
    await prisma.subscription.upsert({
      where: {
        id: 'test-sub-lp-1'
      },
      update: {
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      create: {
        id: 'test-sub-lp-1',
        studentId,
        planId: plan!.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    // Student with active subscription can view the lesson (Attendance is decoupled from online access)
    const subStudentRes = await app.inject({
      method: 'GET',
      url: `/api/v1/lessons/${lockedLessonId}`,
      headers: { authorization: `Bearer ${studentToken}` }
    });
    expect(subStudentRes.statusCode).toBe(200);
    expect(subStudentRes.json().data.isLocked).toBe(false);

    // Student without active subscription remains locked with SUBSCRIPTION_REQUIRED
    const lockedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/lessons/${lockedLessonId}`,
      headers: { authorization: `Bearer ${peerStudentToken}` }
    });

    expect(lockedRes.statusCode).toBe(200);
    const lockedData = lockedRes.json().data;
    expect(lockedData.isLocked).toBe(true);
    expect(['SUBSCRIPTION_REQUIRED', 'ATTENDANCE_REQUIRED']).toContain(lockedData.lockReason);
    expect(lockedData.content).toBeNull(); // Content shielded
    expect(lockedData.videoUrl).toBeNull(); // Video shielded

    // Cleanup session and session lesson
    await prisma.sessionLesson.deleteMany({ where: { sessionId: session.id } });
    await prisma.session.delete({ where: { id: session.id } });
  });
});
