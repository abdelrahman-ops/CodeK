import { ParsedCurriculumPackage, ValidationResult, ValidationCountCheck } from './types.js';

export const OFFICIAL_TITLES: Record<number, string> = {
  1: 'تطور تكنولوجيا المعلومات والتحول الاجتماعي',
  2: 'كيف يعمل الذكاء الاصطناعي',
  3: 'الذكاء الاصطناعي في الحياة اليومية والصناعة',
  4: 'القضايا الأخلاقية المتعلقة بالذكاء الاصطناعي',
  5: 'تقنيات التشفير والمصادقة',
  6: 'تصميم أمن الشبكات',
  7: 'الاستجابة للحوادث وإدارة المخاطر',
  8: 'البنية العامة لتطبيقات الويب',
  9: 'طرق الاتصال في تطبيقات الويب',
  10: 'أساسيات تقنية الواجهة الأمامية',
  11: 'أنواع الوسائط وخصائصها',
  12: 'تصميم المعلومات وتجربة المستخدم للمواقع',
  13: 'أساليب تقييم المواقع الإلكترونية',
  14: 'عملية التحسين التكراري للمواقع'
};

export const EXPECTED_CHAPTER_LESSON_COUNTS: Record<number, number> = {
  1: 4,
  2: 3,
  3: 3,
  4: 4
};

export function validateCurriculumPackage(pkg: ParsedCurriculumPackage): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Structure Checks
  if (!pkg.course) {
    errors.push('Structural Error: Course is missing from package');
  }

  if (pkg.course.chapters.length !== 4) {
    errors.push(`Structural Error: Expected exactly 4 chapters, got ${pkg.course.chapters.length}`);
  }

  for (const ch of pkg.course.chapters) {
    const expectedLessonCount = EXPECTED_CHAPTER_LESSON_COUNTS[ch.order] || 0;
    if (ch.lessons.length !== expectedLessonCount) {
      errors.push(`Structural Error: Chapter ${ch.order} (${ch.title}) expected ${expectedLessonCount} lessons, got ${ch.lessons.length}`);
    }
  }

  // 2. Identity & Uniqueness Checks
  const seenLessonCodes = new Set<string>();
  const seenTaskCodes = new Set<string>();
  const seenChallengeCodes = new Set<string>();
  const seenQuizCodes = new Set<string>();
  const seenVideoCodes = new Set<string>();

  let previousOrder = 0;
  let allLessonsCount = 0;

  for (const ch of pkg.course.chapters) {
    for (const lesson of ch.lessons) {
      allLessonsCount++;

      // Order sequence
      if (lesson.order !== previousOrder + 1) {
        errors.push(`Ordering Error: Lesson ${lesson.code} has order ${lesson.order}, expected ${previousOrder + 1}`);
      }
      previousOrder = lesson.order;

      // Uniqueness
      if (seenLessonCodes.has(lesson.code)) {
        errors.push(`Duplicate Code Error: Lesson code "${lesson.code}" is duplicated`);
      }
      seenLessonCodes.add(lesson.code);

      if (seenTaskCodes.has(lesson.task.code)) {
        errors.push(`Duplicate Code Error: Task code "${lesson.task.code}" is duplicated`);
      }
      seenTaskCodes.add(lesson.task.code);

      if (seenChallengeCodes.has(lesson.challenge.code)) {
        errors.push(`Duplicate Code Error: Challenge code "${lesson.challenge.code}" is duplicated`);
      }
      seenChallengeCodes.add(lesson.challenge.code);

      if (seenQuizCodes.has(lesson.exam.code)) {
        errors.push(`Duplicate Code Error: Exam code "${lesson.exam.code}" is duplicated`);
      }
      seenQuizCodes.add(lesson.exam.code);

      if (seenVideoCodes.has(lesson.video.code)) {
        errors.push(`Duplicate Code Error: Video code "${lesson.video.code}" is duplicated`);
      }
      seenVideoCodes.add(lesson.video.code);

      // Official Title Integrity
      const expectedTitle = OFFICIAL_TITLES[lesson.order];
      if (!expectedTitle) {
        errors.push(`Official Content Error: No expected official title found for order ${lesson.order}`);
      } else if (lesson.officialTitle.trim() !== expectedTitle.trim()) {
        errors.push(
          `Official Content Error: Lesson ${lesson.order} title mismatch! Expected "${expectedTitle}", got "${lesson.officialTitle}"`
        );
      }

      // Page Range
      if (!lesson.pageRange || lesson.pageRange.trim() === '') {
        errors.push(`Official Content Error: Lesson ${lesson.code} is missing official page range`);
      }

      // Authority Checks
      if (lesson.authority !== 'OFFICIAL') {
        errors.push(`Authority Error: Lesson ${lesson.code} authority must be OFFICIAL`);
      }
      if (lesson.task.authority !== 'PROPOSED') {
        errors.push(`Authority Error: Task ${lesson.task.code} authority must be PROPOSED`);
      }
      if (lesson.challenge.authority !== 'PROPOSED') {
        errors.push(`Authority Error: Challenge ${lesson.challenge.code} authority must be PROPOSED`);
      }
      if (lesson.exam.authority !== 'PROPOSED') {
        errors.push(`Authority Error: Exam ${lesson.exam.code} authority must be PROPOSED`);
      }

      // Quiz Questions
      if (lesson.exam.questions.length !== 5) {
        errors.push(
          `Quiz Error: Lesson ${lesson.code} exam "${lesson.exam.code}" has ${lesson.exam.questions.length} questions, expected exactly 5`
        );
      }
    }
  }

  // 3. Count Validation Table
  const counts: Record<string, ValidationCountCheck> = {
    Courses: {
      expected: 1,
      actual: 1,
      status: 'PASS'
    },
    Chapters: {
      expected: 4,
      actual: pkg.course.chapters.length,
      status: pkg.course.chapters.length === 4 ? 'PASS' : 'FAIL'
    },
    Lessons: {
      expected: 14,
      actual: allLessonsCount,
      status: allLessonsCount === 14 ? 'PASS' : 'FAIL'
    },
    'Video Blueprints': {
      expected: 14,
      actual: seenVideoCodes.size,
      status: seenVideoCodes.size === 14 ? 'PASS' : 'FAIL'
    },
    'Engineering Tasks': {
      expected: 14,
      actual: seenTaskCodes.size,
      status: seenTaskCodes.size === 14 ? 'PASS' : 'FAIL'
    },
    'Advanced Challenges': {
      expected: 14,
      actual: seenChallengeCodes.size,
      status: seenChallengeCodes.size === 14 ? 'PASS' : 'FAIL'
    },
    Exams: {
      expected: 14,
      actual: seenQuizCodes.size,
      status: seenQuizCodes.size === 14 ? 'PASS' : 'FAIL'
    },
    Questions: {
      expected: 70,
      actual: pkg.totalQuestions,
      status: pkg.totalQuestions === 70 ? 'PASS' : 'FAIL'
    }
  };

  for (const check of Object.values(counts)) {
    if (check.status === 'FAIL') {
      errors.push(`Count Validation Discrepancy detected in validation table`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts
  };
}
