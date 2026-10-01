import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';

describe('Monthly Exams, Timing Windows and Auto-Grading Module', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let youssefToken: string;
  let youssefStudentId: string;
  let curriculumId: string;
  let examId: string;
  let q1Id: string;
  let q2Id: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    const youssefRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1002', password: 'Student@123' }
    });
    youssefToken = youssefRes.json().data.accessToken;
    youssefStudentId = youssefRes.json().data.user.student.id;

    // Ensure student is assigned GRADE_2 to match curriculum
    await prisma.student.update({
      where: { id: youssefStudentId },
      data: { grade: 'GRADE_2' }
    });

    // Create a GRADE_2 curriculum for the exams
    const courseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Exams Test Track',
        description: 'Track for testing exams with GRADE_2 isolation',
        grade: 'GRADE_2',
        type: 'ACADEMY',
        isPublished: true
      }
    });
    curriculumId = courseRes.json().data.id;

    // Create an active exam associated with the GRADE_2 curriculum
    const examRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exams',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Midterm Algorithms Quiz',
        curriculumId,
        startsAt: new Date(Date.now() - 3600000).toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        durationMinutes: 30,
        totalMarks: 50,
        xpReward: 50,
        isPublished: true
      }
    });
    examId = examRes.json().data.id;

    // Add Q1 (MCQ)
    const q1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${examId}/questions`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        questionText: 'What is time complexity of binary search?',
        questionType: 'MULTIPLE_CHOICE',
        options: ['O(N)', 'O(log N)', 'O(N^2)', 'O(1)'],
        correctAnswer: 'O(log N)',
        marks: 25,
        order: 1
      }
    });
    q1Id = q1Res.json().data.id;

    // Add Q2 (MCQ)
    const q2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${examId}/questions`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        questionText: 'Which data structure follows LIFO?',
        questionType: 'MULTIPLE_CHOICE',
        options: ['Queue', 'Stack', 'Array', 'Tree'],
        correctAnswer: 'Stack',
        marks: 25,
        order: 2
      }
    });
    q2Id = q2Res.json().data.id;
  });

  it('should deliver exam questions to student without exposing correct answers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/exams/${examId}`,
      headers: { authorization: `Bearer ${youssefToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.questions.length).toBe(2);
    expect(body.questions[0]).not.toHaveProperty('correctAnswer');
  });

  it('should block student from accessing unpublished draft exam', async () => {
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exams',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Draft Final Exam',
        curriculumId,
        startsAt: new Date(Date.now() - 3600000).toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        durationMinutes: 60,
        totalMarks: 100,
        xpReward: 100,
        isPublished: false
      }
    });
    const draftExamId = draftRes.json().data.id;

    const accessRes = await app.inject({
      method: 'GET',
      url: `/api/v1/exams/${draftExamId}`,
      headers: { authorization: `Bearer ${youssefToken}` }
    });

    expect(accessRes.statusCode).toBe(404);
  });

  it('should block student from accessing future scheduled exam', async () => {
    const futureRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exams',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Future Scheduled Exam',
        curriculumId,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 172800000).toISOString(),
        durationMinutes: 45,
        totalMarks: 50,
        xpReward: 50,
        isPublished: true
      }
    });
    const futureExamId = futureRes.json().data.id;

    const accessRes = await app.inject({
      method: 'GET',
      url: `/api/v1/exams/${futureExamId}`,
      headers: { authorization: `Bearer ${youssefToken}` }
    });

    expect(accessRes.statusCode).toBe(400);
  });

  it('should automatically grade student attempt and award XP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${examId}/submit`,
      headers: { authorization: `Bearer ${youssefToken}` },
      payload: {
        answers: {
          [q1Id]: 'O(log N)', // Correct (25 pts)
          [q2Id]: 'Stack'      // Correct (25 pts)
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.score).toBe(50);
    expect(body.percentage).toBe(100);
    expect(body.xpEarned).toBe(50);
  });

  it('should prevent student from submitting a duplicate attempt for same exam', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${examId}/submit`,
      headers: { authorization: `Bearer ${youssefToken}` },
      payload: {
        answers: {
          [q1Id]: 'O(log N)',
          [q2Id]: 'Stack'
        }
      }
    });

    expect(res.statusCode).toBe(400);
  });

  it('should block cross-grade student from accessing exam (GRADE_1 student accessing GRADE_2 exam -> 404)', async () => {
    // Login Omar and ensure he has GRADE_1
    const omarRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    const omarToken = omarRes.json().data.accessToken;
    const omarStudentId = omarRes.json().data.user.student.id;
    await prisma.student.update({
      where: { id: omarStudentId },
      data: { grade: 'GRADE_1' }
    });

    const accessRes = await app.inject({
      method: 'GET',
      url: `/api/v1/exams/${examId}`,
      headers: { authorization: `Bearer ${omarToken}` }
    });

    expect(accessRes.statusCode).toBe(404);
  });
});
