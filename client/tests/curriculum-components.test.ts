import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  TextbookProvenance,
  ConceptCardsDeck,
  EngineeringTaskCard,
  AdvancedChallengeCard,
  LessonHeader,
  VideoBlueprintCard,
  LessonProgressFooter
} from '../src/components/curriculum/index.js';
import { Task, ConceptCard, VideoBlueprint } from '../src/types/api.js';
import { MemoryRouter } from 'react-router-dom';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failed++;
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passed++;
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('=== Running Phase 11 Curriculum Components Frontend Test Suite ===\n');

// ----------------------------------------------------
// 1. TextbookProvenance Tests
// ----------------------------------------------------
console.log('--- 1. TextbookProvenance Component Tests ---');
{
  const htmlOfficial = renderToString(
    React.createElement(TextbookProvenance, {
      authority: 'OFFICIAL',
      academicYear: '2025/2026',
      term: 'TERM_1',
      track: 'GENERAL',
      pageRange: 'ص 4 – 11'
    })
  );

  assert(
    htmlOfficial.includes('محتوى مستند إلى منهج وزارة التربية والتعليم المصرية'),
    'Displays factual Ministry curriculum disclaimer'
  );
  assert(
    !htmlOfficial.includes('معتمد من وزارة') && !htmlOfficial.includes('اعتماد رسمي'),
    'Never claims false institutional accreditation'
  );
  assert(
    htmlOfficial.includes('ص <!-- -->4 – 11') || htmlOfficial.includes('4 – 11'),
    'Displays accurate textbook page range'
  );
  assert(htmlOfficial.includes('2025/2026'), 'Displays academic year');
  assert(htmlOfficial.includes('الترم الأول'), 'Displays term label in Arabic');

  // Non-official should return null/empty
  const htmlLegacy = renderToString(
    React.createElement(TextbookProvenance, {
      authority: 'CUSTOM',
      academicYear: '2025/2026'
    })
  );
  assert(htmlLegacy === '', 'Returns null/empty string for non-official courses');
}

// ----------------------------------------------------
// 2. ConceptCardsDeck Tests
// ----------------------------------------------------
console.log('\n--- 2. ConceptCardsDeck Component Tests ---');
{
  const mockCards: ConceptCard[] = [
    {
      order: 1,
      title: 'مفهوم الحوسبة السحابية',
      summary: 'تقديم خدمات الحوسبة عبر الإنترنت',
      keyTakeaway: 'المرونة وتوفير التكاليف',
      tags: ['Cloud', 'IaaS', 'PaaS']
    },
    {
      order: 2,
      title: 'نماذج النشر السحابي',
      summary: 'السحابة العامة والخاصة والمختلطة',
      keyTakeaway: 'اختيار النموذج المناسب لاحتياجات المؤسسة',
      tags: ['Hybrid', 'Public', 'Private']
    }
  ];

  const htmlDeck = renderToString(
    React.createElement(ConceptCardsDeck, {
      cards: mockCards
    })
  );

  assert(htmlDeck.includes('مفهوم الحوسبة السحابية'), 'Renders active concept card title');
  assert(htmlDeck.includes('تقديم خدمات الحوسبة عبر الإنترنت'), 'Renders summary content');
  assert(htmlDeck.includes('الخلاصة:'), 'Renders key takeaway section header');
  assert(htmlDeck.includes('المرونة وتوفير التكاليف'), 'Renders takeaway content');
  assert(htmlDeck.includes('Cloud'), 'Renders terminology tags');
  assert(htmlDeck.includes('1 من 2') || htmlDeck.includes('1<!-- --> من <!-- -->2'), 'Renders card counter');

  // Empty deck returns null
  const htmlEmpty = renderToString(React.createElement(ConceptCardsDeck, { cards: [] }));
  assert(htmlEmpty === '', 'Returns null when cards array is empty');
}

// ----------------------------------------------------
// 3. EngineeringTaskCard Tests
// ----------------------------------------------------
console.log('\n--- 3. EngineeringTaskCard Component Tests ---');
{
  const mockTask: Task = {
    id: 'task-01',
    curriculumId: 'curr-01',
    lessonId: 'lesson-01',
    code: 'G11-T1-TASK-01',
    title: 'تطبيق إعداد شبكة محلية',
    description: 'قم بضبط عنوان IP وإعداد جهاز التوجيه',
    instructions: '1. افتح موجه الأوامر\n2. اكتب ipconfig',
    difficulty: 'INTERMEDIATE',
    taskType: 'DAILY_TASK',
    xpReward: 40,
    deliverableType: 'CODE',
    order: 1,
    authority: 'OFFICIAL',
    isLocked: false
  };

  const htmlTask = renderToString(React.createElement(EngineeringTaskCard, { task: mockTask }));

  assert(htmlTask.includes('G11-T1-TASK-01'), 'Renders official task code badge');
  assert(htmlTask.includes('تطبيق إعداد شبكة محلية'), 'Renders task title');
  assert(htmlTask.includes('40') && htmlTask.includes('XP'), 'Renders task XP reward badge');
  assert(htmlTask.includes('المهمة الهندسية التطبيقية'), 'Renders task category banner');
  assert(htmlTask.includes('لم يُسلّم بعد'), 'Renders unsubmitted status badge');

  // With approved submission
  const mockApprovedTask: Task = {
    ...mockTask,
    mySubmission: {
      id: 'sub-01',
      taskId: 'task-01',
      studentId: 'student-01',
      status: 'APPROVED',
      score: 100,
      xpEarned: 40,
      submittedAt: new Date().toISOString()
    }
  };
  const htmlApproved = renderToString(React.createElement(EngineeringTaskCard, { task: mockApprovedTask }));
  assert(htmlApproved.includes('تم الاعتماد والتقييم'), 'Renders approved submission badge');
}

// ----------------------------------------------------
// 4. AdvancedChallengeCard Tests
// ----------------------------------------------------
console.log('\n--- 4. AdvancedChallengeCard Component Tests ---');
{
  const mockChallenge: Task = {
    id: 'challenge-01',
    curriculumId: 'curr-01',
    lessonId: 'lesson-01',
    code: 'G11-T1-CHALLENGE-01',
    title: 'تحدي تأمين الخادم السحابي',
    description: 'تطبيق سياسات الجدار الناري المتقدمة',
    instructions: 'نفذ قواعد iptables المقترحة',
    difficulty: 'ADVANCED',
    taskType: 'CHALLENGE',
    xpReward: 60,
    deliverableType: 'CODE',
    order: 2,
    authority: 'OFFICIAL',
    isLocked: false
  };

  const htmlChallenge = renderToString(React.createElement(AdvancedChallengeCard, { challenge: mockChallenge }));

  assert(htmlChallenge.includes('G11-T1-CHALLENGE-01'), 'Renders challenge code badge');
  assert(htmlChallenge.includes('تحدي تأمين الخادم السحابي'), 'Renders challenge title');
  assert(htmlChallenge.includes('60') && htmlChallenge.includes('XP'), 'Renders challenge XP reward');
  assert(htmlChallenge.includes('التحدي البرمجي المتقدم'), 'Renders challenge header badge');
}

// ----------------------------------------------------
// 5. LessonHeader Tests
// ----------------------------------------------------
console.log('\n--- 5. LessonHeader Component Tests ---');
{
  const htmlHeader = renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(LessonHeader, {
        title: 'مقدمة في الذكاء الاصطناعي',
        code: 'G11-T1-CH01-L01',
        description: 'شرح المفاهيم التأسيسية لخوارزميات التعلم الآلي',
        difficulty: 'INTERMEDIATE',
        estimatedDurationMinutes: 45,
        authority: 'OFFICIAL',
        curriculumId: 'curr-01',
        curriculumTitle: 'تكنولوجيا المعلومات 2026',
        chapterTitle: 'أساسيات الذكاء الاصطناعي',
        chapterCode: 'G11-T1-CH01'
      })
    )
  );

  assert(htmlHeader.includes('G11-T1-CH01-L01'), 'Renders lesson code badge');
  assert(htmlHeader.includes('G11-T1-CH01'), 'Renders chapter code in breadcrumb');
  assert(htmlHeader.includes('منهج رسمي'), 'Renders official badge');
  assert(htmlHeader.includes('مقدمة في الذكاء الاصطناعي'), 'Renders lesson title');
  assert(htmlHeader.includes('متوسط'), 'Renders localized difficulty badge');
  assert(htmlHeader.includes('45') && htmlHeader.includes('دقيقة'), 'Renders estimated duration');
}

// ----------------------------------------------------
// 6. VideoBlueprintCard Tests
// ----------------------------------------------------
console.log('\n--- 6. VideoBlueprintCard Component Tests ---');
{
  const mockBlueprint: VideoBlueprint = {
    id: 'vb-01',
    code: 'G11-T1-VID-01',
    title: 'مخطط فيديو الدرس الأول',
    provider: 'MOCK',
    durationSeconds: 720,
    metadata: {
      scriptOutline: '1. مقدمة (2 دقيقة)\n2. الشرح النظري (5 دقائق)\n3. التدريب العملي (5 دقائق)',
      targetObjective: 'فهم الفروق الجوهرية بين التعلم الخاضع للإشراف وغير الخاضع له'
    }
  };

  const htmlBlueprint = renderToString(
    React.createElement(VideoBlueprintCard, {
      videoBlueprint: mockBlueprint
    })
  );

  assert(htmlBlueprint.includes('G11-T1-VID-01'), 'Renders video blueprint code');
  assert(htmlBlueprint.includes('مخطط فيديو الدرس الأول'), 'Renders blueprint title label');
  assert(htmlBlueprint.includes('12') && htmlBlueprint.includes('دقيقة'), 'Renders converted duration in minutes');
  assert(htmlBlueprint.includes('هدف الشرح المرئي'), 'Renders objective section header');
  assert(
    htmlBlueprint.includes('فهم الفروق الجوهرية بين التعلم الخاضع للإشراف وغير الخاضع له'),
    'Renders blueprint target objective text'
  );
  assert(htmlBlueprint.includes('الشرح النظري'), 'Renders script outline contents');
}

// ----------------------------------------------------
// 7. LessonProgressFooter Tests
// ----------------------------------------------------
console.log('\n--- 7. LessonProgressFooter Component Tests ---');
{
  const htmlFooter = renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(LessonProgressFooter, {
        isCompleted: false,
        progressPercentage: 40,
        isLocked: false,
        nextLesson: { id: 'l-02', title: 'الدرس الثاني', order: 2 },
        curriculumId: 'curr-01',
        onMarkComplete: async () => {},
        isCompleting: false,
        hasQuiz: true,
        quizCompleted: false,
        onOpenQuiz: () => {}
      })
    )
  );

  assert(htmlFooter.includes('متابعة إنجاز الدرس'), 'Renders in-progress label');
  assert(htmlFooter.includes('40%'), 'Renders progress percentage');
  assert(htmlFooter.includes('إتمام الدرس'), 'Renders mark complete button');
  assert(htmlFooter.includes('الدرس التالي'), 'Renders next lesson navigation link');
  assert(htmlFooter.includes('بدء اختبار الدرس'), 'Renders quiz shortcut button');

  // Locked footer should return null
  const htmlLockedFooter = renderToString(
    React.createElement(LessonProgressFooter, {
      isLocked: true,
      onMarkComplete: async () => {},
      isCompleting: false
    })
  );
  assert(htmlLockedFooter === '', 'Returns null when lesson is locked');
}

console.log(`\n========================================`);
console.log(`All ${passed} Frontend Component Tests Passed! 0 Failed ✅`);
console.log(`========================================\n`);
