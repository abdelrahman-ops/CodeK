import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { XPSourceType, TaskType } from '@prisma/client';

describe('Phase 4: Learning Systems Integration', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let studentUserId: string;
  let parentToken: string;
  let testCourseId: string;
  let lesson1Id: string;
  let lesson2Id: string;
  let quizId: string;
  let taskId: string;
  let projectId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Setup Student
    const studentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    studentToken = studentRes.json().data.accessToken;
    studentUserId = studentRes.json().data.user.id;

    const studentRecord = await prisma.student.findUnique({
      where: { userId: studentUserId }
    });
    studentId = studentRecord!.id;

    // Setup Parent
    const parentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'PAR-2001', password: 'Parent@123' }
    });
    parentToken = parentRes.json().data.accessToken;

    // Ensure FIRST_LESSON_COMPLETED achievement exists
    await prisma.achievement.upsert({
      where: { code: 'FIRST_LESSON_COMPLETED' },
      create: {
        code: 'FIRST_LESSON_COMPLETED',
        name: 'First Step to Mastery',
        description: 'Completed your very first academy lesson.',
        icon: 'book-open',
        xpReward: 50
      },
      update: {}
    });

    // Create Test Course
    const courseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/curriculum',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Phase 4 Integration Track ' + Date.now(),
        description: 'Connecting Learning to Tasks, Quizzes, Exams, and XP'
      }
    });
    testCourseId = courseRes.json().data.id;

    // Create Lesson 1
    const l1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: testCourseId,
        title: 'Lesson 1: Foundations of Logic',
        content: '# Lesson 1 Content',
        order: 1,
        isFree: true,
        accessType: 'FREE'
      }
    });
    lesson1Id = l1Res.json().data.id;

    // Create Lesson 2
    const l2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: testCourseId,
        title: 'Lesson 2: Advanced Data Structures',
        content: '# Lesson 2 Content',
        order: 2,
        isFree: true,
        accessType: 'FREE'
      }
    });
    lesson2Id = l2Res.json().data.id;

    // Create Related Daily Task on Lesson 1
    const taskRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        lessonId: lesson1Id,
        title: 'Logic Gates Exercise',
        description: 'Implement AND, OR, NOT functions',
        instructions: 'Write clean TypeScript functions',
        taskType: 'DAILY_TASK',
        difficulty: 'BEGINNER',
        xpReward: 30
      }
    });
    taskId = taskRes.json().data.id;

    // Create Related Project on Lesson 1
    const projectRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        lessonId: lesson1Id,
        title: 'Calculator Mini Project',
        description: 'Build a CLI calculator in Python',
        instructions: 'Support add, subtract, multiply, divide',
        taskType: 'PROJECT',
        difficulty: 'INTERMEDIATE',
        xpReward: 100
      }
    });
    projectId = projectRes.json().data.id;

    // Create Related Quiz on Lesson 1 (MCQ questions with auto-grading)
    const quizRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exams',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        curriculumId: testCourseId,
        lessonId: lesson1Id,
        isQuiz: true,
        title: 'Logic Quick Quiz',
        description: 'Test your understanding of logic operations',
        durationMinutes: 15,
        totalMarks: 20,
        xpReward: 25,
        isPublished: true
      }
    });
    quizId = quizRes.json().data.id;

    // Add 2 Questions to the Quiz
    await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${quizId}/questions`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        questionText: 'What is true AND false?',
        questionType: 'MULTIPLE_CHOICE',
        options: ['true', 'false', 'undefined'],
        correctAnswer: 'false',
        marks: 10,
        order: 1
      }
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${quizId}/questions`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        questionText: 'What is true OR false?',
        questionType: 'MULTIPLE_CHOICE',
        options: ['true', 'false', 'null'],
        correctAnswer: 'true',
        marks: 10,
        order: 2
      }
    });
  });

  describe('1. Learning to XP & Achievements Pipeline', () => {
    it('marking a lesson completed awards 15 XP to student', async () => {
      const initialStudent = await prisma.student.findUnique({ where: { id: studentId } });
      const startXp = initialStudent?.totalXp || 0;

      const progressRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lessons/${lesson1Id}/progress`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          completed: true,
          status: 'COMPLETED'
        }
      });

      expect(progressRes.statusCode).toBe(200);

      // Verify XP transaction created
      const xpTx = await prisma.xPTransaction.findUnique({
        where: {
          studentId_sourceType_sourceId: {
            studentId,
            sourceType: XPSourceType.LESSON,
            sourceId: lesson1Id
          }
        }
      });

      expect(xpTx).toBeDefined();
      expect(xpTx?.amount).toBe(15);
      expect(xpTx?.sourceType).toBe(XPSourceType.LESSON);

      // Verify student totalXp increased
      const updatedStudent = await prisma.student.findUnique({ where: { id: studentId } });
      expect(updatedStudent?.totalXp).toBeGreaterThanOrEqual(startXp + 15);
    });

    it('marking the same lesson completed again does NOT duplicate XP', async () => {
      const studentBefore = await prisma.student.findUnique({ where: { id: studentId } });

      await app.inject({
        method: 'POST',
        url: `/api/v1/lessons/${lesson1Id}/progress`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          completed: true,
          status: 'COMPLETED'
        }
      });

      const studentAfter = await prisma.student.findUnique({ where: { id: studentId } });
      expect(studentAfter?.totalXp).toBe(studentBefore?.totalXp);
    });
  });

  describe('2. Lesson Associations & Next Steps Pipeline', () => {
    it('GET /api/v1/lessons/:id returns related tasks, quizzes, and structured nextSteps', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lesson1Id}`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;

      // Has associated tasks
      expect(data.tasks).toBeDefined();
      expect(data.tasks.length).toBeGreaterThanOrEqual(2);

      // Has associated quiz
      expect(data.exams).toBeDefined();
      const quiz = data.exams.find((e: any) => e.id === quizId);
      expect(quiz).toBeDefined();
      expect(quiz.isQuiz).toBe(true);

      // Has nextSteps payload
      expect(data.nextSteps).toBeDefined();
      expect(data.nextSteps.quiz?.id).toBe(quizId);
      expect(data.nextSteps.task?.id).toBe(taskId);
      expect(data.nextSteps.project?.id).toBe(projectId);
      expect(data.nextSteps.nextLesson?.id).toBe(lesson2Id);
    });
  });

  describe('3. Quiz Attempt Auto-Grading & XP Flow', () => {
    it('student takes lesson quiz and receives instant auto-graded XP', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/exams/${quizId}/attempt`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          answers: {
            // First question: 'false' (correct, 10 marks)
            // Second question: 'true' (correct, 10 marks)
          }
        }
      });

      // Need question IDs
      const examDetails = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/${quizId}`,
        headers: { authorization: `Bearer ${studentToken}` }
      });
      const questions = examDetails.json().data.questions;

      const attemptRes = await app.inject({
        method: 'POST',
        url: `/api/v1/exams/${quizId}/submit`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          answers: {
            [questions[0].id]: 'false',
            [questions[1].id]: 'true'
          }
        }
      });

      expect(attemptRes.statusCode).toBe(200);
      const attempt = attemptRes.json().data;
      expect(attempt.score).toBe(20);
      expect(attempt.percentage).toBe(100);
      expect(attempt.xpEarned).toBe(25);

      // Verify XP transaction with sourceType: QUIZ
      const quizTx = await prisma.xPTransaction.findFirst({
        where: {
          studentId,
          sourceType: XPSourceType.QUIZ,
          sourceId: attempt.id
        }
      });
      expect(quizTx).toBeDefined();
      expect(quizTx?.amount).toBe(25);
    });
  });

  describe('4. Meaningful Learning Analytics', () => {
    it('student progress includes course progress, lessons completed, tasks, and quiz performance', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/students/${studentId}/progress`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;

      expect(data.learningAnalytics).toBeDefined();
      expect(data.learningAnalytics.courseProgress).toBeDefined();
      expect(data.learningAnalytics.lessonsCompleted.completed).toBeGreaterThanOrEqual(1);
      expect(data.learningAnalytics.quizPerformance.attempted).toBeGreaterThanOrEqual(1);
      expect(data.learningAnalytics.quizPerformance.averageScore).toBe(100);
    });
  });

  describe('5. Student Dashboard 7-Tier Prioritization', () => {
    it('returns all 7 modules prioritized for student success', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/student',
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const dash = res.json().data;

      // Tier 1: Continue Learning
      expect(dash.continueLearning).toBeDefined();
      expect(dash.continueLearning.courseTitle).toBeDefined();

      // Tier 2: Today's Tasks
      expect(dash.tasks).toBeDefined();

      // Tier 3: Upcoming Quiz / Exam
      expect(dash).toHaveProperty('upcomingQuizOrExam');

      // Tier 4: Saturday Session
      expect(dash).toHaveProperty('todaySession');

      // Tier 5: Progress & Meaningful Learning Analytics
      expect(dash.progress).toBeDefined();
      expect(dash.learningAnalytics).toBeDefined();
      expect(dash.learningAnalytics.lessonsCompleted).toBeDefined();

      // Tier 6: XP & Achievements
      expect(dash.achievements).toBeDefined();
      expect(dash.student.totalXp).toBeDefined();

      // Tier 7: Leaderboard
      expect(dash.rank).toBeDefined();
      expect(dash.leaderboardPreview).toBeDefined();
    });
  });

  describe('6. Parent Dashboard & Privacy Safeguards', () => {
    it('parent dashboard receives child learning analytics without peer data', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/parent',
        headers: { authorization: `Bearer ${parentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const parentDash = res.json().data;
      expect(parentDash.children).toBeDefined();
      expect(parentDash.children.length).toBeGreaterThan(0);

      const child = parentDash.children[0];
      expect(child.learningAnalytics).toBeDefined();
      expect(child.learningAnalytics.courseProgress).toBeDefined();
      expect(child.learningAnalytics.lessonsCompleted).toBeDefined();

      // Verify no other students' private data is exposed
      expect(parentDash.otherStudents).toBeUndefined();
    });
  });
});
