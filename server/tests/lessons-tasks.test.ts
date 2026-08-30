import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';

describe('Tasks, Submissions, Review & Safe Deletions Module', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let omarToken: string;
  let omarStudentId: string;
  let groupAId: string;
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

    const groupsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    groupAId = groupsRes.json().data.find((g: any) => g.name === 'Group A').id;

    // Create a new task assigned to Group A
    const taskRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
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
});
