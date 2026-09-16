import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { prisma } from '../src/db/prisma.js';
import { StudentGrade, Role, TaskType, SubscriptionStatus } from '@prisma/client';
import { hashPassword } from '../src/common/utils/crypto.js';

describe('Grade-Based Curriculum Ownership & Student Content Isolation', () => {
  let app: FastifyInstance;
  let adminToken: string;

  let grade1StudentToken: string;
  let grade1StudentId: string;
  let grade1UserId: string;

  let grade2StudentToken: string;
  let grade2StudentId: string;
  let grade2UserId: string;

  let curriculumGrade1Id: string;
  let sectionGrade1Id: string;
  let lessonGrade1Id: string;
  let taskGrade1Id: string;
  let examGrade1Id: string;

  let curriculumGrade2Id: string;
  let sectionGrade2Id: string;
  let lessonGrade2Id: string;
  let taskGrade2Id: string;
  let examGrade2Id: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    const timestamp = Date.now();
    const pwdHash = await hashPassword('Password@123');

    // 1. Create Grade 1 Student
    const userG1 = await prisma.user.create({
      data: {
        loginId: `STU-G1-${timestamp}`,
        email: `stu.g1.${timestamp}@codek.test`,
        passwordHash: pwdHash,
        role: Role.STUDENT,
        firstName: 'Ziad',
        lastName: 'GradeOne',
        mustChangePassword: false,
        isEmailVerified: true,
        student: {
          create: {
            studentCode: `STU-G1-${timestamp}`,
            anonymousLeaderboardCode: `LEAD-G1-${timestamp}`,
            grade: StudentGrade.GRADE_1,
            learningModeSelected: true
          }
        }
      },
      include: { student: true }
    });
    grade1UserId = userG1.id;
    grade1StudentId = userG1.student!.id;

    // Give Grade 1 student an active subscription
    const planG1 = await prisma.subscriptionPlan.findFirst({ where: { code: 'GRADE_1_MONTHLY' } });
    if (planG1) {
      await prisma.subscription.create({
        data: {
          studentId: grade1StudentId,
          planId: planG1.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    }

    const loginResG1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: `STU-G1-${timestamp}`, password: 'Password@123' }
    });
    grade1StudentToken = loginResG1.json().data.accessToken;

    // 2. Create Grade 2 Student
    const userG2 = await prisma.user.create({
      data: {
        loginId: `STU-G2-${timestamp}`,
        email: `stu.g2.${timestamp}@codek.test`,
        passwordHash: pwdHash,
        role: Role.STUDENT,
        firstName: 'Kareem',
        lastName: 'GradeTwo',
        mustChangePassword: false,
        isEmailVerified: true,
        student: {
          create: {
            studentCode: `STU-G2-${timestamp}`,
            anonymousLeaderboardCode: `LEAD-G2-${timestamp}`,
            grade: StudentGrade.GRADE_2,
            learningModeSelected: true
          }
        }
      },
      include: { student: true }
    });
    grade2UserId = userG2.id;
    grade2StudentId = userG2.student!.id;

    // Give Grade 2 student an active subscription
    const planG2 = await prisma.subscriptionPlan.findFirst({ where: { code: 'GRADE_2_MONTHLY' } });
    if (planG2) {
      await prisma.subscription.create({
        data: {
          studentId: grade2StudentId,
          planId: planG2.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    }

    const loginResG2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: `STU-G2-${timestamp}`, password: 'Password@123' }
    });
    grade2StudentToken = loginResG2.json().data.accessToken;

    // 3. Create Grade 1 Educational Content
    const cur1 = await prisma.curriculum.create({
      data: {
        code: `CUR-G1-${timestamp}`,
        title: 'منهج الصف الأول الثانوي — برمجة 1',
        grade: StudentGrade.GRADE_1,
        isPublished: true
      }
    });
    curriculumGrade1Id = cur1.id;

    const sec1 = await prisma.section.create({
      data: {
        curriculumId: cur1.id,
        title: 'الوحدة الأولى: مدخل الخوارزميات (G1)',
        order: 1,
        isPublished: true
      }
    });
    sectionGrade1Id = sec1.id;

    const les1 = await prisma.lesson.create({
      data: {
        curriculumId: cur1.id,
        sectionId: sec1.id,
        title: 'الدرس الأول: المتغيرات والثوابت (G1)',
        content: '# درس الصف الأول الثانوي',
        order: 1,
        isPublished: true,
        videoUrl: 'https://video.codek.test/g1/lesson1.mp4'
      }
    });
    lessonGrade1Id = les1.id;

    const task1 = await prisma.task.create({
      data: {
        lessonId: les1.id,
        title: 'مهمة المتغيرات (G1)',
        description: 'قم بكتابة برنامج بلغة بايثون',
        instructions: 'اطبع المتغير x',
        taskType: TaskType.DAILY_TASK,
        xpReward: 50,
        isPublished: true
      }
    });
    taskGrade1Id = task1.id;

    const exam1 = await prisma.exam.create({
      data: {
        curriculumId: cur1.id,
        lessonId: les1.id,
        title: 'امتحان منتصف الفصل للصف الأول (G1)',
        startsAt: new Date(Date.now() - 3600 * 1000),
        endsAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        durationMinutes: 60,
        totalMarks: 100,
        isPublished: true,
        questions: {
          create: [
            {
              questionText: 'ما نوع المتغير في بايثون x = 5 ؟',
              options: JSON.stringify(['int', 'str', 'bool', 'float']),
              correctAnswer: 'int',
              marks: 100,
              order: 1
            }
          ]
        }
      }
    });
    examGrade1Id = exam1.id;

    // 4. Create Grade 2 Educational Content
    const cur2 = await prisma.curriculum.create({
      data: {
        code: `CUR-G2-${timestamp}`,
        title: 'منهج الصف الثاني الثانوي — ذكاء اصطناعي 2',
        grade: StudentGrade.GRADE_2,
        isPublished: true
      }
    });
    curriculumGrade2Id = cur2.id;

    const sec2 = await prisma.section.create({
      data: {
        curriculumId: cur2.id,
        title: 'الوحدة الأولى: الشبكات العصبية (G2)',
        order: 1,
        isPublished: true
      }
    });
    sectionGrade2Id = sec2.id;

    const les2 = await prisma.lesson.create({
      data: {
        curriculumId: cur2.id,
        sectionId: sec2.id,
        title: 'الدرس الأول: تدريب النموذج (G2)',
        content: '# درس الصف الثاني الثانوي',
        order: 1,
        isPublished: true,
        videoUrl: 'https://video.codek.test/g2/lesson2.mp4'
      }
    });
    lessonGrade2Id = les2.id;

    const task2 = await prisma.task.create({
      data: {
        lessonId: les2.id,
        title: 'مهمة تدريب النموذج (G2)',
        description: 'قم بتدريب نموذج تصنيف صور',
        instructions: 'استخدم مكتبة PyTorch',
        taskType: TaskType.DAILY_TASK,
        xpReward: 100,
        isPublished: true
      }
    });
    taskGrade2Id = task2.id;

    const exam2 = await prisma.exam.create({
      data: {
        curriculumId: cur2.id,
        lessonId: les2.id,
        title: 'امتحان منتصف الفصل للصف الثاني (G2)',
        startsAt: new Date(Date.now() - 3600 * 1000),
        endsAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        durationMinutes: 60,
        totalMarks: 100,
        isPublished: true,
        questions: {
          create: [
            {
              questionText: 'ما هي دالة التنشيط الأكثر استخداماً في الطبقات الخفية؟',
              options: JSON.stringify(['ReLU', 'Sigmoid', 'Softmax', 'Tanh']),
              correctAnswer: 'ReLU',
              marks: 100,
              order: 1
            }
          ]
        }
      }
    });
    examGrade2Id = exam2.id;
  });

  // =========================================================================
  // 1. READ Isolation — Own Grade Access
  // =========================================================================
  describe('1. Own Grade Access (200 OK)', () => {
    it('Grade 1 student can access Grade 1 curriculum', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/curriculum/${curriculumGrade1Id}`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(curriculumGrade1Id);
    });

    it('Grade 1 student can access Grade 1 lesson and playback', async () => {
      const resLesson = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade1Id}`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(resLesson.statusCode).toBe(200);
      expect(resLesson.json().data.id).toBe(lessonGrade1Id);

      const resPlayback = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade1Id}/playback`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(resPlayback.statusCode).toBe(200);
    });

    it('Grade 1 student can access Grade 1 task and exam', async () => {
      const resTask = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskGrade1Id}`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(resTask.statusCode).toBe(200);
      expect(resTask.json().data.id).toBe(taskGrade1Id);

      const resExam = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/${examGrade1Id}`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(resExam.statusCode).toBe(200);
      expect(resExam.json().data.id).toBe(examGrade1Id);
    });

    it('Grade 2 student can access Grade 2 curriculum, lesson, task, and exam', async () => {
      const resCur = await app.inject({
        method: 'GET',
        url: `/api/v1/curriculum/${curriculumGrade2Id}`,
        headers: { authorization: `Bearer ${grade2StudentToken}` }
      });
      expect(resCur.statusCode).toBe(200);

      const resLesson = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade2Id}`,
        headers: { authorization: `Bearer ${grade2StudentToken}` }
      });
      expect(resLesson.statusCode).toBe(200);

      const resPlayback = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade2Id}/playback`,
        headers: { authorization: `Bearer ${grade2StudentToken}` }
      });
      expect(resPlayback.statusCode).toBe(200);

      const resTask = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskGrade2Id}`,
        headers: { authorization: `Bearer ${grade2StudentToken}` }
      });
      expect(resTask.statusCode).toBe(200);

      const resExam = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/${examGrade2Id}`,
        headers: { authorization: `Bearer ${grade2StudentToken}` }
      });
      expect(resExam.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // 2. READ Isolation — Direct-ID Cross-Grade Blocking (Must return 404)
  // =========================================================================
  describe('2. Direct-ID Cross-Grade Protection (Strictly 404 Not Found)', () => {
    it('Grade 1 student receives 404 when directly requesting Grade 2 Curriculum ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/curriculum/${curriculumGrade2Id}`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(404);
    });

    it('Grade 1 student receives 404 when directly requesting Grade 2 Sections', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/curriculum/${curriculumGrade2Id}/sections`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(404);
    });

    it('Grade 1 student receives 404 when directly requesting Grade 2 Lesson ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade2Id}`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(404);
    });

    it('Grade 1 student receives 404 when directly requesting Grade 2 Playback', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade2Id}/playback`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(404);
    });

    it('Grade 1 student receives 404 when directly requesting Grade 2 Task ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskGrade2Id}`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(404);
    });

    it('Grade 1 student receives 404 when directly requesting Grade 2 Exam ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/${examGrade2Id}`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(404);
    });

    it('Grade 2 student receives 404 when directly requesting Grade 1 Curriculum ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/curriculum/${curriculumGrade1Id}`,
        headers: { authorization: `Bearer ${grade2StudentToken}` }
      });
      expect(res.statusCode).toBe(404);
    });

    it('Grade 2 student receives 404 when directly requesting Grade 1 Lesson ID and Playback', async () => {
      const resLesson = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade1Id}`,
        headers: { authorization: `Bearer ${grade2StudentToken}` }
      });
      expect(resLesson.statusCode).toBe(404);

      const resPlayback = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade1Id}/playback`,
        headers: { authorization: `Bearer ${grade2StudentToken}` }
      });
      expect(resPlayback.statusCode).toBe(404);
    });

    it('Grade 2 student receives 404 when directly requesting Grade 1 Task and Exam', async () => {
      const resTask = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskGrade1Id}`,
        headers: { authorization: `Bearer ${grade2StudentToken}` }
      });
      expect(resTask.statusCode).toBe(404);

      const resExam = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/${examGrade1Id}`,
        headers: { authorization: `Bearer ${grade2StudentToken}` }
      });
      expect(resExam.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 3. List Queries — Database Query Level Isolation
  // =========================================================================
  describe('3. List Queries Contain Only Student Grade (Zero Cross-Grade Leaks)', () => {
    it('Grade 1 student listing curricula receives only Grade 1 curricula', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/curriculum',
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(200);
      const items: any[] = res.json().data;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.every((c) => c.grade === 'GRADE_1')).toBe(true);
      expect(items.some((c) => c.id === curriculumGrade2Id)).toBe(false);
      expect(items.some((c) => c.id === curriculumGrade1Id)).toBe(true);
    });

    it('Grade 2 student listing curricula receives only Grade 2 curricula', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/curriculum',
        headers: { authorization: `Bearer ${grade2StudentToken}` }
      });
      expect(res.statusCode).toBe(200);
      const items: any[] = res.json().data;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.every((c) => c.grade === 'GRADE_2')).toBe(true);
      expect(items.some((c) => c.id === curriculumGrade1Id)).toBe(false);
      expect(items.some((c) => c.id === curriculumGrade2Id)).toBe(true);
    });

    it('Grade 1 student listing lessons receives only Grade 1 lessons', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lessons',
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(200);
      const items: any[] = res.json().data;
      expect(items.some((l) => l.id === lessonGrade2Id)).toBe(false);
      expect(items.some((l) => l.id === lessonGrade1Id)).toBe(true);
    });

    it('Grade 1 student listing tasks receives only Grade 1 tasks', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(200);
      const items: any[] = res.json().data;
      expect(items.some((t) => t.id === taskGrade2Id)).toBe(false);
      expect(items.some((t) => t.id === taskGrade1Id)).toBe(true);
    });

    it('Grade 1 student listing exams receives only Grade 1 exams', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/exams',
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(200);
      const items: any[] = res.json().data;
      expect(items.some((e) => e.id === examGrade2Id)).toBe(false);
      expect(items.some((e) => e.id === examGrade1Id)).toBe(true);
    });
  });

  // =========================================================================
  // 4. WRITE Isolation — Cross-Grade Mutations Fail (404 Not Found)
  // =========================================================================
  describe('4. Cross-Grade Writes Fail (404 Not Found)', () => {
    it('Grade 1 student cannot submit a solution to a Grade 2 task (404 Not Found)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskGrade2Id}/submit`,
        headers: { authorization: `Bearer ${grade1StudentToken}` },
        payload: { content: 'print("Trying to hack Grade 2")' }
      });
      expect(res.statusCode).toBe(404);
    });

    it('Grade 1 student cannot submit an exam attempt for a Grade 2 exam (404 Not Found)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/exams/${examGrade2Id}/attempt`,
        headers: { authorization: `Bearer ${grade1StudentToken}` },
        payload: { answers: { dummy: 'ReLU' } }
      });
      expect(res.statusCode).toBe(404);
    });

    it('Grade 1 student cannot update progress on a Grade 2 lesson (404 Not Found)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/lessons/${lessonGrade2Id}/progress`,
        headers: { authorization: `Bearer ${grade1StudentToken}` },
        payload: { progressPercentage: 80, lastWatchedPosition: 120 }
      });
      expect(res.statusCode).toBe(404);
    });

    it('Grade 2 student cannot submit solution, exam attempt, or progress to Grade 1 (404 Not Found)', async () => {
      const resTask = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskGrade1Id}/submit`,
        headers: { authorization: `Bearer ${grade2StudentToken}` },
        payload: { content: 'Cross grade task submission' }
      });
      expect(resTask.statusCode).toBe(404);

      const resExam = await app.inject({
        method: 'POST',
        url: `/api/v1/exams/${examGrade1Id}/attempt`,
        headers: { authorization: `Bearer ${grade2StudentToken}` },
        payload: { answers: { dummy: 'int' } }
      });
      expect(resExam.statusCode).toBe(404);

      const resProgress = await app.inject({
        method: 'POST',
        url: `/api/v1/lessons/${lessonGrade1Id}/progress`,
        headers: { authorization: `Bearer ${grade2StudentToken}` },
        payload: { progressPercentage: 100, lastWatchedPosition: 300 }
      });
      expect(resProgress.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 5. Dashboard, Search & Aggregations Isolation
  // =========================================================================
  describe('5. Aggregations & Dashboard Isolation', () => {
    it('Grade 1 student dashboard aggregates only Grade 1 content and zero Grade 2 content', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/student',
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;

      // continueLearning fallback or progress must be Grade 1
      if (data.continueLearning) {
        expect(data.continueLearning.courseId).not.toBe(curriculumGrade2Id);
        expect(data.continueLearning.lessonId).not.toBe(lessonGrade2Id);
      }

      // upcomingQuizOrExam must not be Grade 2
      if (data.upcomingQuizOrExam) {
        expect(data.upcomingQuizOrExam.id).not.toBe(examGrade2Id);
      }

      // activeExam must not be Grade 2
      if (data.activeExam) {
        expect(data.activeExam.id).not.toBe(examGrade2Id);
      }

      // tasks must not contain Grade 2
      if (data.tasks) {
        expect(data.tasks.some((t: any) => t.id === taskGrade2Id)).toBe(false);
      }
    });

    it('Grade 1 student summary lists only Grade 1 courses and stats', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/curriculum/student/summary',
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(200);
      const courses: any[] = res.json().data;
      expect(courses.some((c) => c.id === curriculumGrade2Id)).toBe(false);
      expect(courses.some((c) => c.id === curriculumGrade1Id)).toBe(true);
    });

    it('Grade 1 student progress counts reflect only Grade 1 metrics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/students/${grade1StudentId}/progress`,
        headers: { authorization: `Bearer ${grade1StudentToken}` }
      });
      expect(res.statusCode).toBe(200);
      const learning = res.json().data.learningAnalytics;
      // Published lessons count in Grade 1 should NOT include the Grade 2 lesson
      expect(learning.lessonsCompleted.total).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 6. Exam Ownership Invariant
  // =========================================================================
  describe('6. Exam -> Curriculum -> StudentGrade Invariant', () => {
    it('automatically derives curriculumId from lesson when lessonId is supplied', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/exams',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Quiz with derived curriculumId',
          lessonId: lessonGrade1Id,
          totalMarks: 50,
          isPublished: true
        }
      });
      expect(res.statusCode).toBe(201);
      const exam = res.json().data;
      expect(exam.curriculumId).toBe(curriculumGrade1Id);
    });

    it('rejects conflicting lessonId + curriculumId combinations (400 Bad Request)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/exams',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Conflicting Exam',
          lessonId: lessonGrade1Id, // Belongs to Curriculum Grade 1
          curriculumId: curriculumGrade2Id, // Conflicts with Curriculum Grade 2
          totalMarks: 50
        }
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // 7. Admin Unrestricted Access & Filtering
  // =========================================================================
  describe('7. Admin Unrestricted Access Across All Grades', () => {
    it('Admin can list curricula across all grades without restriction', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/curriculum',
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(res.statusCode).toBe(200);
      const items: any[] = res.json().data;
      expect(items.some((c) => c.id === curriculumGrade1Id)).toBe(true);
      expect(items.some((c) => c.id === curriculumGrade2Id)).toBe(true);
    });

    it('Admin can filter curricula by grade', async () => {
      const resG1 = await app.inject({
        method: 'GET',
        url: '/api/v1/curriculum?grade=GRADE_1',
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(resG1.statusCode).toBe(200);
      expect(resG1.json().data.every((c: any) => c.grade === 'GRADE_1')).toBe(true);

      const resG2 = await app.inject({
        method: 'GET',
        url: '/api/v1/curriculum?grade=GRADE_2',
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(resG2.statusCode).toBe(200);
      expect(resG2.json().data.every((c: any) => c.grade === 'GRADE_2')).toBe(true);
    });

    it('Admin can access both Grade 1 and Grade 2 individual lessons', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade1Id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(res1.statusCode).toBe(200);

      const res2 = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade2Id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(res2.statusCode).toBe(200);
    });

    it('Admin can access both Grade 1 and Grade 2 exams', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/${examGrade1Id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(res1.statusCode).toBe(200);

      const res2 = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/${examGrade2Id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(res2.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // 8. Registration Canonical StudentGrade Enum Validation
  // =========================================================================
  describe('8. Student Registration Canonical Enum Validation', () => {
    it('accepts valid canonical StudentGrade enum values', async () => {
      const ts = Date.now();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Canonical',
          lastName: 'Student',
          email: `canonical_${ts}@codek.test`,
          password: 'Password@123',
          grade: 'GRADE_3'
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.user.student.grade).toBe('GRADE_3');
    });

    it('rejects arbitrary strings for grade during registration (400 Bad Request)', async () => {
      const ts = Date.now();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          firstName: 'Invalid',
          lastName: 'Student',
          email: `invalid_${ts}@codek.test`,
          password: 'Password@123',
          grade: 'ARBITRARY_GRADE_STRING'
        }
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // 9. Legacy NULL-Grade Student Fail-Closed Safety & Admin Grade Assignment
  // =========================================================================
  describe('9. Legacy NULL-Grade Student Fail-Closed Safety & Admin Grade Assignment', () => {
    let legacyStudentToken: string;
    let legacyStudentId: string;
    let legacyUserId: string;

    beforeAll(async () => {
      const ts = Date.now();
      const pwdHash = await hashPassword('Password@123');

      // Create a student explicitly with grade: null (simulating legacy database record)
      const userLegacy = await prisma.user.create({
        data: {
          loginId: `STU-LEGACY-${ts}`,
          email: `stu.legacy.${ts}@codek.test`,
          passwordHash: pwdHash,
          role: Role.STUDENT,
          firstName: 'Legacy',
          lastName: 'Student',
          mustChangePassword: false,
          isEmailVerified: true,
          student: {
            create: {
              studentCode: `STU-LEGACY-${ts}`,
              anonymousLeaderboardCode: `LEAD-LEGACY-${ts}`,
              grade: null,
              learningModeSelected: true
            }
          }
        },
        include: { student: true }
      });
      legacyUserId = userLegacy.id;
      legacyStudentId = userLegacy.student!.id;

      // Give student an active subscription to ensure subscription is NOT the barrier
      const plan = await prisma.subscriptionPlan.findFirst({ where: { code: 'GRADE_1_MONTHLY' } });
      if (plan) {
        await prisma.subscription.create({
          data: {
            studentId: legacyStudentId,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });
      }

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { loginId: `STU-LEGACY-${ts}`, password: 'Password@123' }
      });
      legacyStudentToken = loginRes.json().data.accessToken;
    });

    it('NULL-grade student cannot list curricula across grades (returns empty array)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/curriculum',
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });

    it('NULL-grade student cannot directly access any curriculum by ID (404 Not Found)', async () => {
      const resG1 = await app.inject({
        method: 'GET',
        url: `/api/v1/curriculum/${curriculumGrade1Id}`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resG1.statusCode).toBe(404);

      const resG2 = await app.inject({
        method: 'GET',
        url: `/api/v1/curriculum/${curriculumGrade2Id}`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resG2.statusCode).toBe(404);
    });

    it('NULL-grade student cannot access lessons (list is empty, direct access returns 404)', async () => {
      const resList = await app.inject({
        method: 'GET',
        url: '/api/v1/lessons',
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resList.statusCode).toBe(200);
      expect(resList.json().data).toEqual([]);

      const resG1 = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade1Id}`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resG1.statusCode).toBe(404);

      const resG2 = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade2Id}`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resG2.statusCode).toBe(404);
    });

    it('NULL-grade student cannot obtain video playback for any lesson (404 Not Found)', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url: `/api/v1/videos/lessons/${lessonGrade1Id}/playback`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(res1.statusCode).toBe(404);

      const res2 = await app.inject({
        method: 'GET',
        url: `/api/v1/videos/lessons/${lessonGrade2Id}/playback`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(res2.statusCode).toBe(404);
    });

    it('NULL-grade student cannot access tasks (list is empty, direct access returns 404)', async () => {
      const resList = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resList.statusCode).toBe(200);
      expect(resList.json().data).toEqual([]);

      const resG1 = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskGrade1Id}`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resG1.statusCode).toBe(404);

      const resG2 = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskGrade2Id}`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resG2.statusCode).toBe(404);
    });

    it('NULL-grade student cannot access exams (list is empty, direct access returns 404)', async () => {
      const resList = await app.inject({
        method: 'GET',
        url: '/api/v1/exams',
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resList.statusCode).toBe(200);
      expect(resList.json().data).toEqual([]);

      const resG1 = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/${examGrade1Id}`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resG1.statusCode).toBe(404);

      const resG2 = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/${examGrade2Id}`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resG2.statusCode).toBe(404);
    });

    it('NULL-grade student cannot submit tasks (404 Not Found)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskGrade1Id}/submit`,
        headers: { authorization: `Bearer ${legacyStudentToken}` },
        payload: { content: 'print("NULL student submit attempt")' }
      });
      expect(res.statusCode).toBe(404);
    });

    it('NULL-grade student cannot submit exam attempts (404 Not Found)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/exams/${examGrade1Id}/attempt`,
        headers: { authorization: `Bearer ${legacyStudentToken}` },
        payload: { answers: { q1: 'test' } }
      });
      expect(res.statusCode).toBe(404);
    });

    it('NULL-grade student cannot update lesson progress (404 Not Found)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/lessons/${lessonGrade1Id}/progress`,
        headers: { authorization: `Bearer ${legacyStudentToken}` },
        payload: { progressPercentage: 50, lastWatchedPosition: 60 }
      });
      expect(res.statusCode).toBe(404);
    });

    it('NULL-grade student dashboard/analytics fails closed (no cross-grade content received)', async () => {
      const resDash = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/student',
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resDash.statusCode).toBe(200);
      const dash = resDash.json().data;
      expect(dash.todayLessons).toEqual([]);
      expect(dash.tasks).toEqual([]);
      expect(dash.activeExam).toBeNull();
      expect(dash.upcomingQuizOrExam).toBeNull();
      expect(dash.continueLearning).toBeNull();

      const resProgress = await app.inject({
        method: 'GET',
        url: `/api/v1/students/${legacyStudentId}/progress`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resProgress.statusCode).toBe(200);
      const progress = resProgress.json().data;
      expect(progress.learningAnalytics.lessonsCompleted.total).toBe(0);
      expect(progress.learningAnalytics.tasksCompleted.total).toBe(0);
    });

    it('Admin can assign a valid grade to a legacy student, granting immediate grade-scoped access', async () => {
      // 1. Admin updates legacy student grade to GRADE_1
      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/students/${legacyStudentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { grade: 'GRADE_1' }
      });
      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().data.grade).toBe('GRADE_1');

      // 2. Student now immediately has access to Grade 1 curricula
      const resCurricula = await app.inject({
        method: 'GET',
        url: '/api/v1/curriculum',
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resCurricula.statusCode).toBe(200);
      const curricula = resCurricula.json().data;
      expect(curricula.some((c: any) => c.id === curriculumGrade1Id)).toBe(true);
      expect(curricula.some((c: any) => c.id === curriculumGrade2Id)).toBe(false);

      // 3. Direct access to Grade 1 lesson now succeeds
      const resLessonG1 = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade1Id}`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resLessonG1.statusCode).toBe(200);

      // 4. Direct access to Grade 2 lesson remains strictly blocked (404)
      const resLessonG2 = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${lessonGrade2Id}`,
        headers: { authorization: `Bearer ${legacyStudentToken}` }
      });
      expect(resLessonG2.statusCode).toBe(404);
    });
  });
});

