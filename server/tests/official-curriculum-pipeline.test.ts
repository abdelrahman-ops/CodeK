import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, pool } from '../src/db/prisma.js';
import { parseContentSpec, PIPELINE_VERSION } from '../prisma/seeds/curriculum/content-spec-parser.js';
import { validateCurriculumPackage } from '../prisma/seeds/curriculum/curriculum-validator.js';
import {
  captureLegacySnapshot,
  calculateDiff,
  executeSeed,
  runAudit,
  verifyLegacySafety
} from '../prisma/seeds/curriculum/curriculum-pipeline.js';
import { ContentAuthority, StudentGrade, TaskType } from '@prisma/client';

describe('Phase 10: Official Curriculum Ingestion & Integrity Pipeline', () => {
  let parsedPkg: ReturnType<typeof parseContentSpec>;

  beforeAll(async () => {
    parsedPkg = parseContentSpec();

    // Ensure clean state for official curriculum package only (never touches legacy data)
    await prisma.curriculum.deleteMany({ where: { code: 'G11-T1-EB-2026' } });
    await prisma.videoAsset.deleteMany({
      where: { code: { in: Array.from({ length: 14 }, (_, i) => `VID-${String(i + 1).padStart(2, '0')}`) } }
    });
  });

  // -------------------------------------------------------------
  // Unit Tests: Parser & Validator (Zero DB Dependency)
  // -------------------------------------------------------------
  describe('Content Spec Parser & Pure Validation', () => {
    it('1. should parse valid specification with exact SHA-256 hash and metadata', () => {
      expect(parsedPkg.specHash).toBeDefined();
      expect(parsedPkg.specHash.length).toBe(64);
      expect(parsedPkg.pipelineVersion).toBe(PIPELINE_VERSION);
      expect(parsedPkg.course.code).toBe('G11-T1-EB-2026');
      expect(parsedPkg.course.title).toBe('البرمجة والذكاء الاصطناعي — الصف الثاني الثانوي (الترم الأول)');
      expect(parsedPkg.course.authority).toBe(ContentAuthority.OFFICIAL);
    });

    it('2. should extract exactly 4 chapters with exact expected lesson counts', () => {
      expect(parsedPkg.totalChapters).toBe(4);
      expect(parsedPkg.course.chapters[0].lessons.length).toBe(4); // Ch 1
      expect(parsedPkg.course.chapters[1].lessons.length).toBe(3); // Ch 2
      expect(parsedPkg.course.chapters[2].lessons.length).toBe(3); // Ch 3
      expect(parsedPkg.course.chapters[3].lessons.length).toBe(4); // Ch 4
    });

    it('3. should extract exactly 14 lessons with official metadata and sequential order', () => {
      expect(parsedPkg.totalLessons).toBe(14);
      parsedPkg.course.chapters.forEach(ch => {
        ch.lessons.forEach(l => {
          expect(l.officialTitle).toBeTruthy();
          expect(l.pageRange).toBeTruthy();
          expect(l.description).toBeTruthy();
          expect(l.content).toBeTruthy();
          expect(l.authority).toBe(ContentAuthority.OFFICIAL);
          expect(l.conceptCards.length).toBeGreaterThan(0);
        });
      });
    });

    it('4. should extract exactly 14 video blueprints, tasks, challenges, and quizzes', () => {
      expect(parsedPkg.totalVideos).toBe(14);
      expect(parsedPkg.totalTasks).toBe(14);
      expect(parsedPkg.totalChallenges).toBe(14);
      expect(parsedPkg.totalExams).toBe(14);
      expect(parsedPkg.totalQuestions).toBe(70);
    });

    it('5. should pass pure validation for the authoritative specification', () => {
      const validation = validateCurriculumPackage(parsedPkg);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.counts.Courses.status).toBe('PASS');
      expect(validation.counts.Chapters.status).toBe('PASS');
      expect(validation.counts.Lessons.status).toBe('PASS');
      expect(validation.counts.Questions.status).toBe('PASS');
    });

    it('6. should fail validation on duplicate lesson code', () => {
      const cloned = JSON.parse(JSON.stringify(parsedPkg));
      cloned.course.chapters[0].lessons[1].code = cloned.course.chapters[0].lessons[0].code;
      const validation = validateCurriculumPackage(cloned);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e: string) => e.includes('Duplicate Code Error'))).toBe(true);
    });

    it('7. should fail validation on missing or mismatched official title', () => {
      const cloned = JSON.parse(JSON.stringify(parsedPkg));
      cloned.course.chapters[0].lessons[0].officialTitle = 'Wrong Marketing Title';
      const validation = validateCurriculumPackage(cloned);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e: string) => e.includes('Official Content Error: Lesson 1 title mismatch'))).toBe(true);
    });

    it('8. should fail validation on wrong lesson ordering or missing chapter', () => {
      const cloned = JSON.parse(JSON.stringify(parsedPkg));
      cloned.course.chapters[0].lessons[1].order = 99;
      const validation = validateCurriculumPackage(cloned);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e: string) => e.includes('Ordering Error'))).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Integration Tests: Dry-Run, Seed Idempotency & Legacy Safety
  // -------------------------------------------------------------
  describe('Database Pipeline Execution & Safety', () => {
    it('9. should compute dry-run mutations without altering database state', async () => {
      const beforeSnapshot = await captureLegacySnapshot(prisma);
      const diff = await calculateDiff(prisma, parsedPkg);

      expect(diff.conflicts).toBe(0);
      expect(diff.creates).toBe(75);

      const afterSnapshot = await captureLegacySnapshot(prisma);
      const safety = verifyLegacySafety(beforeSnapshot, afterSnapshot);
      expect(safety.safe).toBe(true);
    });

    it('10. should execute first seed run and create all 75 canonical entities', async () => {
      const beforeSnapshot = await captureLegacySnapshot(prisma);
      const seedResult = await executeSeed(prisma, parsedPkg);

      expect(seedResult.success).toBe(true);
      expect(seedResult.created).toBeGreaterThanOrEqual(75);

      const afterSnapshot = await captureLegacySnapshot(prisma);
      const safety = verifyLegacySafety(beforeSnapshot, afterSnapshot);
      expect(safety.safe).toBe(true);
    });

    it('11. should demonstrate 100% idempotency on second seed run (0 new records created)', async () => {
      const beforeSnapshot = await captureLegacySnapshot(prisma);
      const seedResult = await executeSeed(prisma, parsedPkg);

      expect(seedResult.success).toBe(true);
      expect(seedResult.created).toBe(0); // 0 new records created!

      const afterSnapshot = await captureLegacySnapshot(prisma);
      const safety = verifyLegacySafety(beforeSnapshot, afterSnapshot);
      expect(safety.safe).toBe(true);
    });

    it('12. should demonstrate 100% idempotency on third seed run', async () => {
      const seedResult = await executeSeed(prisma, parsedPkg);
      expect(seedResult.success).toBe(true);
      expect(seedResult.created).toBe(0);
    });

    it('13. should verify mock video asset integrity (provider=MOCK, playbackUrl=null)', async () => {
      const videos = await prisma.videoAsset.findMany({
        where: { code: { in: Array.from({ length: 14 }, (_, i) => `VID-${String(i + 1).padStart(2, '0')}`) } }
      });

      expect(videos).toHaveLength(14);
      for (const v of videos) {
        expect(v.provider).toBe('MOCK');
        expect(v.providerVideoId).toMatch(/^MOCK-VID-\d{2}$/);
        expect(v.playbackUrl).toBeNull();
        expect(v.authority).toBe(ContentAuthority.PROPOSED);
        expect((v.metadata as any)?.isMock).toBe(true);
      }
    });

    it('14. should verify persistence of both Daily Tasks and Advanced Challenges', async () => {
      const lessons = await prisma.lesson.findMany({
        where: { curriculum: { code: parsedPkg.course.code } },
        include: { tasks: true }
      });

      expect(lessons).toHaveLength(14);
      for (const l of lessons) {
        const daily = l.tasks.find(t => t.taskType === TaskType.DAILY_TASK);
        const challenge = l.tasks.find(t => t.taskType === TaskType.CHALLENGE);

        expect(daily).toBeDefined();
        expect(daily?.code).toBe(`${l.code}-TASK`);
        expect(daily?.authority).toBe(ContentAuthority.PROPOSED);

        expect(challenge).toBeDefined();
        expect(challenge?.code).toBe(`${l.code}-CHALLENGE`);
        expect(challenge?.authority).toBe(ContentAuthority.PROPOSED);
      }
    });

    it('15. should run post-seed audit and verify complete database integrity against spec', async () => {
      const auditResult = await runAudit(prisma, parsedPkg);
      expect(auditResult.status).toBe('PASS');
      expect(auditResult.checks.every(c => c.status === 'PASS')).toBe(true);
      expect(auditResult.totalChapters).toBe(4);
      expect(auditResult.totalLessons).toBe(14);
      expect(auditResult.totalVideos).toBe(14);
      expect(auditResult.totalTasks).toBe(14);
      expect(auditResult.totalChallenges).toBe(14);
      expect(auditResult.totalExams).toBe(14);
      expect(auditResult.totalQuestions).toBe(70);
    });

    it('16. should detect and reject ownership conflicts if foreign curriculum uses same code', async () => {
      // Simulate conflict: a foreign curriculum having section code G11-T1-CH01
      const fakeForeignCurriculum = await prisma.curriculum.create({
        data: {
          title: 'Foreign Test Curriculum',
          description: 'Conflict simulation',
          authority: ContentAuthority.PROPOSED,
          grade: StudentGrade.GRADE_2
        }
      });

      const conflictSection = await prisma.section.create({
        data: {
          curriculumId: fakeForeignCurriculum.id,
          code: 'G11-T1-CH01', // conflict with official chapter 1!
          title: 'Conflicting Foreign Section',
          order: 99
        }
      });

      try {
        const diff = await calculateDiff(prisma, parsedPkg);
        expect(diff.conflicts).toBeGreaterThan(0);
        expect(diff.items.some(i => i.action === 'CONFLICT' && i.code === 'G11-T1-CH01')).toBe(true);
      } finally {
        await prisma.section.delete({ where: { id: conflictSection.id } });
        await prisma.curriculum.delete({ where: { id: fakeForeignCurriculum.id } });
      }
    });

    it('17. should verify --audit mode performs zero database mutations', async () => {
      const beforeSnapshot = await captureLegacySnapshot(prisma);
      const auditResult = await runAudit(prisma, parsedPkg);
      const afterSnapshot = await captureLegacySnapshot(prisma);

      expect(auditResult.status).toBe('PASS');
      const safety = verifyLegacySafety(beforeSnapshot, afterSnapshot);
      expect(safety.safe).toBe(true);
    });

    it('18. should detect corruption and report FAIL during audit if records are missing', async () => {
      // Temporarily simulate corrupted package expecting 15 lessons
      const corruptedPkg = JSON.parse(JSON.stringify(parsedPkg));
      corruptedPkg.totalLessons = 15;
      const auditResult = await runAudit(prisma, corruptedPkg, null);

      expect(auditResult.status).toBe('FAIL');
      expect(auditResult.totalLessons).toBe(14); // in DB
      expect(auditResult.checks.some(c => c.name === 'Lessons Count' && c.status === 'FAIL')).toBe(true);
    });
  });
});

