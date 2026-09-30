import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';

describe('Tasks, Submissions, Review & Safe Deletions Module', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let omarToken: string;
  let omarStudentId: string;
  let groupAId: string;
  let curriculumId: string;
  let sectionId: string;
  let lessonId: string;
  let taskId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    const omarRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    omarToken = omarRes.json().data.accessToken;
    omarStudentId = omarRes.json().data.user.student.id;

    // Ensure student is assigned GRADE_1
    await prisma.student.update({
      where: { id: omarStudentId },
      data: { grade: 'GRADE_1' }
    });

    const groupsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    groupAId = groupsRes.json().data.find((g: any) => g.name === 'Group A').id;

    // Create Curriculum { grade: 'GRADE_1' } -> Section -> Lesson hierarchy
    const courseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Tasks Test Track G1',
        description: 'Track for tasks testing',
        grade: 'GRADE_1',
        type: 'ACADEMY',
        isPublished: true
      }
    });
    curriculumId = courseRes.json().data.id;

    const sectionRes = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${curriculumId}/sections`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Tasks Section 1',
        order: 1,
        isPublished: true
      }
    });
    sectionId = sectionRes.json().data.id;

    const lessonRes = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId,
        sectionId,
        title: 'Tasks Lesson 1',
        content: 'Lesson content for task submissions',
        isPublished: true
      }
    });
    lessonId = lessonRes.json().data.id;

    // Create a new task assigned to Group A and linked to Lesson
    const taskRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        lessonId,
        title: 'Fibonacci Sequence Generator',
        description: 'Generate the first N Fibonacci numbers',
        instructions: 'Submit Python code solution',
        taskType: 'DAILY_TASK',
        xpReward: 30,
        groupIds: [groupAId]
      }
    });
    taskId = taskRes.json().data.id;
  });

  it('should allow student in Group A to submit task', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/submissions',
      headers: { authorization: `Bearer ${omarToken}` },
      payload: {
        taskId,
        content: 'def fib(n): return [0, 1] if n == 2 else ...'
      }
    });

    expect(res.statusCode).toBe(201);
    const sub = res.json().data;
    expect(sub.status).toBe('PENDING');
    expect(sub.studentId).toBe(omarStudentId);
  });

  it('should allow Admin to review submission and award XP atomically', async () => {
    // Get submission id
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/submissions?taskId=${taskId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    const submissions = listRes.json().data;
    const submissionId = submissions[0].id;

    // Review submission -> APPROVED
    const reviewRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/submissions/${submissionId}/review`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        status: 'APPROVED',
        feedback: 'Spot on solution!'
      }
    });

    expect(reviewRes.statusCode).toBe(200);
    expect(reviewRes.json().data.status).toBe('APPROVED');

    // Verify XP history recorded for task
    const xpRes = await app.inject({
      method: 'GET',
      url: `/api/v1/gamification/xp-history?studentId=${omarStudentId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(xpRes.statusCode).toBe(200);
    const xpRecords = xpRes.json().data;
    const taskXP = xpRecords.find((x: any) => x.sourceId === taskId && x.sourceType === 'TASK');
    expect(taskXP).toBeDefined();
    expect(taskXP.amount).toBe(30);
  });

  it('should block deletion of a task that has student submissions', async () => {
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tasks/${taskId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(deleteRes.statusCode).toBe(400);
    expect(deleteRes.json().error.code).toBe('BAD_REQUEST');
  });

  it('should allow safe deletion of an unsubmitted task', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Temporary Unsubmitted Task',
        description: 'No submissions yet',
        instructions: 'Test instructions',
        taskType: 'DAILY_TASK',
        xpReward: 20
      }
    });
    expect(createRes.statusCode).toBe(201);
    const emptyTaskId = createRes.json().data.id;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tasks/${emptyTaskId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().data.success).toBe(true);
  });

  it('should block cross-grade student from submitting task (GRADE_2 student submitting GRADE_1 task -> 404)', async () => {
    // Login Youssef and ensure GRADE_2
    const youssefRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1002', password: 'Student@123' }
    });
    const youssefToken = youssefRes.json().data.accessToken;
    const youssefStudentId = youssefRes.json().data.user.student.id;
    await prisma.student.update({
      where: { id: youssefStudentId },
      data: { grade: 'GRADE_2' }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/submissions',
      headers: { authorization: `Bearer ${youssefToken}` },
      payload: {
        taskId,
        content: 'def fib(n): return [0, 1]'
      }
    });

    expect(res.statusCode).toBe(404);
  });

  it('should reject malformed submission with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/submissions',
      headers: { authorization: `Bearer ${omarToken}` },
      payload: {
        taskId
        // missing content, fileUrl, and githubUrl
      }
    });

    expect(res.statusCode).toBe(400);
  });
});
