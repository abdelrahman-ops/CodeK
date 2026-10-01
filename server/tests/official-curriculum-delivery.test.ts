import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, loginAdmin } from './helpers/test-app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db/prisma.js';
import { ContentAuthority, TaskType } from '@prisma/client';
import { hashPassword } from '../src/common/utils/crypto.js';

describe('Phase 11: Official Curriculum Delivery, Shielding & Quiz Idempotency', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let studentUserId: string;
  let officialCurriculumId: string;
  let officialLessonId: string;
  let officialQuizId: string;

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = await loginAdmin(app);

    // Login default test student (STU-1001 / Omar)
    const omarRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { loginId: 'STU-1001', password: 'Student@123' }
    });
    studentToken = omarRes.json().data.accessToken;
    studentId = omarRes.json().data.user.student.id;
    studentUserId = omarRes.json().data.user.id;

    // Ensure student is assigned GRADE_2 to match G11 official curriculum
    await prisma.student.update({
      where: { id: studentId },
      data: { grade: 'GRADE_2' }
    });

    // Retrieve official curriculum G11-T1-EB-2026
    const officialCourse = await prisma.curriculum.findUnique({
      where: { code: 'G11-T1-EB-2026' },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          include: {
            exams: { where: { isQuiz: true } }
          }
        }
      }
    });

    if (!officialCourse) {
      throw new Error('Official course G11-T1-EB-2026 not found in DB. Run seed first.');
    }

    officialCurriculumId = officialCourse.id;
    officialLessonId = officialCourse.lessons[0].id; // Lesson 1-1
    officialQuizId = officialCourse.lessons[0].exams[0]?.id;
  });

  // -------------------------------------------------------------
  // 1. Official Course & Provenance Metadata Delivery
  // -------------------------------------------------------------
  describe('1. Official Course & Provenance Metadata Delivery', () => {
    it('should return official provenance metadata on GET /curriculum/:id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/curriculum/${officialCurriculumId}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;

      expect(data.code).toBe('G11-T1-EB-2026');
      expect(data.title).toBe('البرمجة والذكاء الاصطناعي — الصف الثاني الثانوي (الترم الأول)');
      expect(data.authority).toBe(ContentAuthority.OFFICIAL);
      expect(data.academicYear).toBe('2026/2027');
      expect(data.term).toBe('TERM_1');
      expect(data.type).toBe('OFFICIAL_EB');

      // Check Sections (Chapters)
      expect(data.sections).toHaveLength(4);
      const ch1 = data.sections.find((s: any) => s.code === 'G11-T1-CH01');
      expect(ch1).toBeDefined();
      expect(ch1.authority).toBe(ContentAuthority.OFFICIAL);
      expect(ch1.lessons).toHaveLength(4);

      // Check Lesson Provenance Fields
      const l1 = ch1.lessons[0];
      expect(l1.code).toBe('G11-T1-CH01-L01');
      expect(l1.pageRange).toContain('4 – 11');
      expect(l1.authority).toBe(ContentAuthority.OFFICIAL);
      expect(l1.order).toBe(1);
    });

    it('should include provenance metadata in GET /curriculum/student/summary', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/curriculum/student/summary',
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const list = res.json().data;
      const officialSummary = list.find((c: any) => c.code === 'G11-T1-EB-2026');

      expect(officialSummary).toBeDefined();
      expect(officialSummary.academicYear).toBe('2026/2027');
      expect(officialSummary.term).toBe('TERM_1');
      expect(officialSummary.authority).toBe(ContentAuthority.OFFICIAL);
      expect(officialSummary.totalLessons).toBe(14);
    });
  });

  // -------------------------------------------------------------
  // 2. Protected Learning Content vs Public Provenance Security
  // -------------------------------------------------------------
  describe('2. Content vs Provenance Security (Locked Shielding)', () => {
    let unentitledStudentToken: string;
    let unentitledStudentId: string;

    beforeAll(async () => {
      // Create a fresh test student with no grants or subscriptions
      const suffix = Date.now().toString().slice(-5);
      const pwdHash = await hashPassword('Student@123');
      const testUser = await prisma.user.create({
        data: {
          loginId: `STU-LOCK-${suffix}`,
          email: `locked.student.${suffix}@test.com`,
          passwordHash: pwdHash,
          role: 'STUDENT',
          firstName: 'Locked',
          lastName: 'Student',
          mustChangePassword: false,
          isEmailVerified: true,
          isActive: true,
          student: {
            create: {
              studentCode: `STU-LOCK-${suffix}`,
              anonymousLeaderboardCode: `CODEK-${suffix}`,
              learningModeSelected: true,
              grade: 'GRADE_2'
            }
          }
        },
        include: { student: true }
      });

      unentitledStudentId = testUser.student!.id;

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { loginId: testUser.loginId, password: 'Student@123' }
      });

      unentitledStudentToken = loginRes.json().data.accessToken;
    });

    it('should shield educational content while preserving provenance on locked lesson', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${officialLessonId}`,
        headers: { authorization: `Bearer ${unentitledStudentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const lesson = res.json().data;

      // Access state
      expect(lesson.isLocked).toBe(true);
      expect(lesson.lockReason).toBeTruthy();
      expect(lesson.lockMessage).toBeTruthy();

      // Protected content MUST BE SHIELDED (null or empty)
      expect(lesson.content).toBeNull();
      expect(lesson.conceptCards).toBeNull();
      expect(lesson.videoUrl).toBeNull();
      expect(lesson.videoId).toBeNull();
      expect(lesson.video).toBeNull();
      expect(lesson.videoBlueprint).toBeNull();
      expect(lesson.tasks).toEqual([]);
      expect(lesson.exams).toEqual([]);
      expect(lesson.engineeringTask).toBeNull();
      expect(lesson.advancedChallenge).toBeNull();
      expect(lesson.quiz).toBeNull();
      expect(lesson.nextSteps).toBeNull();

      // Public structural provenance metadata MUST BE PRESERVED
      expect(lesson.id).toBe(officialLessonId);
      expect(lesson.code).toBe('G11-T1-CH01-L01');
      expect(lesson.pageRange).toContain('4 – 11');
      expect(lesson.authority).toBe(ContentAuthority.OFFICIAL);
      expect(lesson.title).toBeTruthy();
      expect(lesson.description).toBeTruthy();
      expect(lesson.order).toBe(1);
      expect(lesson.difficulty).toBe('INTERMEDIATE');
      expect(lesson.curriculum).toBeDefined();
      expect(lesson.curriculum.code).toBe('G11-T1-EB-2026');
      expect(lesson.curriculum.academicYear).toBe('2026/2027');
      expect(lesson.curriculum.term).toBe('TERM_1');
      expect(lesson.section).toBeDefined();
      expect(lesson.section.code).toBe('G11-T1-CH01');
    });
  });

  // -------------------------------------------------------------
  // 3. Unlocked Official Lesson Delivery & Segregated Structures
  // -------------------------------------------------------------
  describe('3. Unlocked Official Lesson Delivery & Segregation', () => {
    let grantId: string;

    beforeAll(async () => {
      // Grant student access to official course
      const grant = await prisma.educationalAccessGrant.create({
        data: {
          studentId,
          scope: 'COURSE',
          curriculumId: officialCurriculumId,
          reason: 'Phase 11 test grant',
          isActive: true
        }
      });
      grantId = grant.id;
    });

    afterAll(async () => {
      if (grantId) {
        await prisma.educationalAccessGrant.delete({ where: { id: grantId } }).catch(() => {});
      }
    });

    it('should return complete unlocked learning content with segregated tasks and concept cards', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${officialLessonId}`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const lesson = res.json().data;

      expect(lesson.isLocked).toBe(false);

      // Markdown content
      expect(lesson.content).toBeTruthy();
      expect(lesson.content.length).toBeGreaterThan(50);

      // Concept Cards Deck
      expect(Array.isArray(lesson.conceptCards)).toBe(true);
      expect(lesson.conceptCards.length).toBeGreaterThanOrEqual(1);
      const firstCard = lesson.conceptCards[0];
      expect(firstCard.title).toBeTruthy();
      expect(firstCard.explanation || firstCard.summary).toBeTruthy();
      expect(firstCard.takeaway).toBeDefined();
      expect(Array.isArray(firstCard.terminology)).toBe(true);

      // Video Blueprint
      expect(lesson.videoBlueprint).toBeDefined();
      expect(lesson.videoBlueprint.code).toBe('VID-01');
      expect(lesson.videoBlueprint.provider).toBe('MOCK');
      expect(lesson.videoBlueprint.durationSeconds).toBeGreaterThan(0);

      // Segregated Engineering Task (DAILY_TASK)
      expect(lesson.engineeringTask).toBeDefined();
      expect(lesson.engineeringTask.taskType).toBe(TaskType.DAILY_TASK);
      expect(lesson.engineeringTask.code).toBe('G11-T1-CH01-L01-TASK');
      expect(lesson.engineeringTask.instructions).toBeTruthy();

      // Segregated Advanced Challenge (CHALLENGE)
      expect(lesson.advancedChallenge).toBeDefined();
      expect(lesson.advancedChallenge.taskType).toBe(TaskType.CHALLENGE);
      expect(lesson.advancedChallenge.code).toBe('G11-T1-CH01-L01-CHALLENGE');
      expect(lesson.advancedChallenge.instructions).toBeTruthy();

      // Segregated Quiz
      expect(lesson.quiz).toBeDefined();
      expect(lesson.quiz.isQuiz).toBe(true);
      expect(lesson.quiz.code).toBe('G11-T1-CH01-L01-QUIZ');

      // Backward compatible tasks and exams arrays preserved
      expect(lesson.tasks.length).toBeGreaterThanOrEqual(2);
      expect(lesson.exams.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------
  // 4. Official Content Integrity (Observable 500 Failure on Corruption)
  // -------------------------------------------------------------
  describe('4. Official Content Integrity & Corruption Handling', () => {
    it('should throw 500 OFFICIAL_CURRICULUM_CORRUPTION on malformed official conceptCards', async () => {
      // Temporarily corrupt conceptCards on an official lesson
      const originalLesson = await prisma.lesson.findUnique({
        where: { id: officialLessonId },
        select: { conceptCards: true }
      });

      // Update to malformed data (invalid structure not matching ConceptCard schema)
      await prisma.lesson.update({
        where: { id: officialLessonId },
        data: {
          conceptCards: [{ invalidField: 123, missingTitleAndExplanation: true }] as any
        }
      });

      try {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/lessons/${officialLessonId}`,
          headers: { authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(500);
        const err = res.json().error || res.json();
        expect(err.message).toContain('OFFICIAL_CURRICULUM_CORRUPTION');
      } finally {
        // Restore original concept cards
        await prisma.lesson.update({
          where: { id: officialLessonId },
          data: { conceptCards: originalLesson!.conceptCards as any }
        });
      }
    });

    it('should return empty array for official lesson with null conceptCards without error', async () => {
      const originalLesson = await prisma.lesson.findUnique({
        where: { id: officialLessonId },
        select: { conceptCards: true }
      });

      await prisma.lesson.update({
        where: { id: officialLessonId },
        data: { conceptCards: null }
      });

      try {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/lessons/${officialLessonId}`,
          headers: { authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().data.conceptCards).toEqual([]);
      } finally {
        await prisma.lesson.update({
          where: { id: officialLessonId },
          data: { conceptCards: originalLesson!.conceptCards as any }
        });
      }
    });

    it('should gracefully fallback to [] for non-official / legacy lesson with malformed cards', async () => {
      // Create a test non-official lesson
      const nonOfficialLesson = await prisma.lesson.create({
        data: {
          curriculumId: officialCurriculumId,
          title: 'Custom Community Lesson',
          content: 'Some community content',
          authority: ContentAuthority.DERIVED,
          conceptCards: 'invalid json string here' as any
        }
      });

      try {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/lessons/${nonOfficialLesson.id}`,
          headers: { authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().data.conceptCards).toEqual([]);
      } finally {
        await prisma.lesson.delete({ where: { id: nonOfficialLesson.id } }).catch(() => {});
      }
    });
  });

  // -------------------------------------------------------------
  // 5. Quiz Answer Sanitization
  // -------------------------------------------------------------
  describe('5. Quiz Answer Sanitization', () => {
    it('should sanitize correctAnswer from questions on student GET /exams/:id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/${officialQuizId}`,
        headers: { authorization: `Bearer ${studentToken}` }
      });

      expect(res.statusCode).toBe(200);
      const exam = res.json().data;

      expect(exam.isQuiz).toBe(true);
      expect(exam.code).toBe('G11-T1-CH01-L01-QUIZ');
      expect(exam.questions.length).toBe(5);

      for (const q of exam.questions) {
        expect(q.questionText).toBeTruthy();
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.marks).toBeGreaterThan(0);
        // CRITICAL SECURITY ASSERTION: correctAnswer MUST NEVER BE EXPOSED
        expect((q as any).correctAnswer).toBeUndefined();
      }
    });
  });

  // -------------------------------------------------------------
  // 6. Quiz XP Idempotency & Repeated Submission Safety
  // -------------------------------------------------------------
  describe('6. Quiz XP Idempotency & Repeated Submission Safety', () => {
    let idempotencyStudentToken: string;
    let idempotencyStudentId: string;

    beforeAll(async () => {
      // Create dedicated student for quiz idempotency testing
      const suffix = Date.now().toString().slice(-5);
      const pwdHash = await hashPassword('Student@123');
      const testUser = await prisma.user.create({
        data: {
          loginId: `STU-IDEM-${suffix}`,
          email: `idem.student.${suffix}@test.com`,
          passwordHash: pwdHash,
          role: 'STUDENT',
          firstName: 'Quiz',
          lastName: 'Tester',
          mustChangePassword: false,
          isEmailVerified: true,
          isActive: true,
          student: {
            create: {
              studentCode: `STU-IDEM-${suffix}`,
              anonymousLeaderboardCode: `CODEK-${suffix}`,
              learningModeSelected: true,
              grade: 'GRADE_2'
            }
          }
        },
        include: { student: true }
      });

      idempotencyStudentId = testUser.student!.id;

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { loginId: testUser.loginId, password: 'Student@123' }
      });

      idempotencyStudentToken = loginRes.json().data.accessToken;

      // Clean up any existing attempt by this student on the quiz
      await prisma.examAttempt.deleteMany({
        where: { examId: officialQuizId, studentId: idempotencyStudentId }
      });
    });

    afterAll(async () => {
      await prisma.examAttempt.deleteMany({
        where: { examId: officialQuizId, studentId: idempotencyStudentId }
      });
    });

    it('should award XP on first attempt and reject duplicate submissions with 400 and zero duplicate XP', async () => {
      // Get student starting XP
      const stuBefore = await prisma.student.findUnique({
        where: { id: idempotencyStudentId },
        select: { totalXp: true }
      });
      const initialXp = stuBefore?.totalXp || 0;

      // Fetch questions to get valid question IDs
      const examDb = await prisma.exam.findUnique({
        where: { id: officialQuizId },
        include: { questions: true }
      });
      const answers: Record<string, string> = {};
      examDb?.questions.forEach(q => {
        answers[q.id] = q.correctAnswer || 'A';
      });

      // 1. First submission
      const sub1 = await app.inject({
        method: 'POST',
        url: `/api/v1/exams/${officialQuizId}/submit`,
        headers: { authorization: `Bearer ${idempotencyStudentToken}` },
        payload: { answers }
      });

      expect(sub1.statusCode).toBe(200);
      const attempt1 = sub1.json().data;
      expect(attempt1.score).toBeGreaterThan(0);
      expect(attempt1.xpEarned).toBeGreaterThan(0);

      // Verify DB student XP incremented
      const stuAfterFirst = await prisma.student.findUnique({
        where: { id: idempotencyStudentId },
        select: { totalXp: true }
      });
      const xpAfterFirst = stuAfterFirst?.totalXp || 0;
      expect(xpAfterFirst).toBeGreaterThanOrEqual(initialXp + attempt1.xpEarned);

      // 2. Second submission (repeated submit / retry)
      const sub2 = await app.inject({
        method: 'POST',
        url: `/api/v1/exams/${officialQuizId}/submit`,
        headers: { authorization: `Bearer ${idempotencyStudentToken}` },
        payload: { answers }
      });

      // MUST FAIL WITH 400
      expect(sub2.statusCode).toBe(400);
      const err2 = sub2.json().error || sub2.json();
      expect(err2.message).toContain('already submitted an attempt');

      // CRITICAL IDEMPOTENCY ASSERTION: XP MUST NOT INCREASE
      const stuAfterSecond = await prisma.student.findUnique({
        where: { id: idempotencyStudentId },
        select: { totalXp: true }
      });
      expect(stuAfterSecond?.totalXp).toBe(xpAfterFirst);

      // 3. Third submission attempt
      const sub3 = await app.inject({
        method: 'POST',
        url: `/api/v1/exams/${officialQuizId}/submit`,
        headers: { authorization: `Bearer ${idempotencyStudentToken}` },
        payload: { answers: {} }
      });

      expect(sub3.statusCode).toBe(400);
      const stuAfterThird = await prisma.student.findUnique({
        where: { id: idempotencyStudentId },
        select: { totalXp: true }
      });
      expect(stuAfterThird?.totalXp).toBe(xpAfterFirst);

      // Verify only ONE attempt record exists in database
      const attemptCount = await prisma.examAttempt.count({
        where: { examId: officialQuizId, studentId: idempotencyStudentId }
      });
      expect(attemptCount).toBe(1);
    });
  });

  // -------------------------------------------------------------
  // 7. Legacy Course Backward Compatibility
  // -------------------------------------------------------------
  describe('7. Legacy Course Backward Compatibility', () => {
    let legacyCurriculumId: string;
    let legacyLessonId: string;

    beforeAll(async () => {
      // Find any non-official / legacy curriculum
      const legacyCourse = await prisma.curriculum.findFirst({
        where: {
          authority: { not: ContentAuthority.OFFICIAL }
        },
        include: { lessons: true }
      });

      if (legacyCourse && legacyCourse.lessons.length > 0) {
        legacyCurriculumId = legacyCourse.id;
        legacyLessonId = legacyCourse.lessons[0].id;
      }
    });

    it('should gracefully return legacy curriculum with null official fields', async () => {
      if (!legacyCurriculumId) return; // Skip if no legacy record in this environment

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/curriculum/${legacyCurriculumId}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.id).toBe(legacyCurriculumId);
      // Legacy courses may have null code, academicYear, term
      expect(data.title).toBeTruthy();
    });

    it('should gracefully render legacy lesson without crashing', async () => {
      if (!legacyLessonId) return;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/lessons/${legacyLessonId}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const lesson = res.json().data;
      expect(lesson.id).toBe(legacyLessonId);
      expect(lesson.title).toBeTruthy();
      expect(lesson.content).toBeTruthy();
      // conceptCards should be an array (empty array fallback for legacy)
      expect(Array.isArray(lesson.conceptCards)).toBe(true);
    });
  });
});
