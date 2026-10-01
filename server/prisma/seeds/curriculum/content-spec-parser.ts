import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  ParsedCurriculumPackage,
  ParsedCourse,
  ParsedChapter,
  ParsedLesson,
  ParsedVideo,
  ParsedConceptCard,
  ParsedTask,
  ParsedChallenge,
  ParsedExam,
  ParsedQuestion
} from './types.js';
import { ContentAuthority, CurriculumType, Difficulty, QuestionType, TaskType } from '@prisma/client';

export const PIPELINE_VERSION = '1.0.0';

export function parseContentSpec(filePath?: string): ParsedCurriculumPackage {
  const resolvedPath = filePath || path.resolve(process.cwd(), '../docs/curriculum/CODEK_OFFICIAL_CONTENT_SPEC.md');
  const fallbackPath = path.resolve(process.cwd(), 'docs/curriculum/CODEK_OFFICIAL_CONTENT_SPEC.md');

  let rawContent = '';
  if (fs.existsSync(resolvedPath)) {
    rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  } else if (fs.existsSync(fallbackPath)) {
    rawContent = fs.readFileSync(fallbackPath, 'utf-8');
  } else {
    throw new Error(`Content specification file not found at "${resolvedPath}" or "${fallbackPath}"`);
  }

  const specHash = crypto.createHash('sha256').update(rawContent, 'utf-8').digest('hex');

  // 1. Course Definition
  const course: ParsedCourse = {
    code: 'G11-T1-EB-2026',
    title: 'البرمجة والذكاء الاصطناعي — الصف الثاني الثانوي (الترم الأول)',
    description: 'المنهج الرسمي المعتمد لوزارة التربية والتعليم المصرية — رؤية مصر 2030 (AI & Web Architecture)',
    type: CurriculumType.OFFICIAL_EB,
    track: 'AI & Web Architecture',
    academicYear: '2026/2027',
    term: 'TERM_1',
    authority: ContentAuthority.OFFICIAL,
    chapters: []
  };

  // Chapter definitions map
  const chapterDefs: Record<number, { code: string; title: string }> = {
    1: { code: 'G11-T1-CH01', title: 'الفصل الأول: تكنولوجيا المعلومات والمجتمع' },
    2: { code: 'G11-T1-CH02', title: 'الفصل الثاني: الأمن السيبراني' },
    3: { code: 'G11-T1-CH03', title: 'الفصل الثالث: تطبيقات الويب' },
    4: { code: 'G11-T1-CH04', title: 'الفصل الرابع: تصميم الويب والوسائط' }
  };

  const chapters: ParsedChapter[] = [1, 2, 3, 4].map(num => ({
    code: chapterDefs[num].code,
    chapterNumber: num,
    title: chapterDefs[num].title,
    order: num,
    authority: ContentAuthority.OFFICIAL,
    lessons: []
  }));

  // 2. Parse Lessons from Markdown
  // Split content by lesson heading: "## الدرس "
  const lessonSections = rawContent.split(/\n##\s+الدرس\s+/);
  // First item is before the first lesson (headers, hierarchy)
  const lessonBlocks = lessonSections.slice(1);

  let globalOrder = 1;
  const parsedLessons: ParsedLesson[] = [];

  for (const block of lessonBlocks) {
    const lines = block.split('\n');
    const headerLine = lines[0].trim(); // e.g. "1-1: تطور تكنولوجيا المعلومات والتحول الاجتماعي"
    const colonIdx = headerLine.indexOf(':');
    const lessonNumber = (colonIdx !== -1 ? headerLine.substring(0, colonIdx) : headerLine.split(' ')[0]).trim();
    const chapterNum = parseInt(lessonNumber.split('-')[0], 10) || 1;
    const lessonSubNum = parseInt(lessonNumber.split('-')[1], 10) || 1;

    const chapterCode = chapterDefs[chapterNum]?.code || `G11-T1-CH0${chapterNum}`;
    const chapterTitle = chapterDefs[chapterNum]?.title || `الفصل ${chapterNum}`;
    const lessonCode = `${chapterCode}-L${String(lessonSubNum).padStart(2, '0')}`;

    // Extract Official Title
    let officialTitle = colonIdx !== -1 ? headerLine.substring(colonIdx + 1).trim() : headerLine;
    const identityMatch = block.match(/\*\s+\*\*العنوان الرسمي:\*\*\s+`?([^`\n]+)`?/);
    if (identityMatch) {
      officialTitle = identityMatch[1].trim();
    }

    // Extract Page Range
    let pageRange = '';
    const pageMatch = block.match(/\(ص\s+([^)]+)\)/);
    if (pageMatch) {
      pageRange = pageMatch[1].trim();
    }

    // Extract Student Description
    let description = '';
    const descMatch = block.match(/### وصف الدرس للطالب[^]*?\n([^#]+)/);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    // Extract Learning Outcomes
    const learningOutcomes: string[] = [];
    const outcomesMatch = block.match(/### مخرجات التعلم[^]*?\n((?:\d+\..*\n?)+)/);
    if (outcomesMatch) {
      const outcomeLines = outcomesMatch[1].split('\n');
      for (const line of outcomeLines) {
        const cleaned = line.replace(/^\d+\.\s*/, '').trim();
        if (cleaned) learningOutcomes.push(cleaned);
      }
    }

    // Extract Core Concepts
    const coreConcepts: string[] = [];
    const conceptsMatch = block.match(/### المفاهيم والمصطلحات الأساسية[^]*?\n((?:\*.*\n?)+)/);
    if (conceptsMatch) {
      const conceptLines = conceptsMatch[1].split('\n');
      for (const line of conceptLines) {
        const cleaned = line.replace(/^\*\s*/, '').trim();
        if (cleaned) coreConcepts.push(cleaned);
      }
    }

    // Extract Lesson Explanation Content
    let content = '';
    const contentMatch = block.match(/### هيكل الشرح التعليمي[^]*?\n((?:\d+\..*\n?)+)/);
    if (contentMatch) {
      content = contentMatch[1].trim();
    } else {
      content = description;
    }

    // Extract Video Spec
    const videoCode = `VID-${String(globalOrder).padStart(2, '0')}`;
    let videoTitle = `شرح ${officialTitle}`;
    let videoDuration = 12;
    let videoObjective = `استيعاب وتطبيق مفاهيم ${officialTitle}`;
    let videoOutline = '';

    const vidBlockMatch = block.match(/### مواصفة الفيديو المقترح[^]*?(?=###|$)/);
    if (vidBlockMatch) {
      const vidText = vidBlockMatch[0];
      const vtMatch = vidText.match(/\*\s+\*\*العنوان المقترح:\*\*\s+`?([^`\n]+)`?/);
      if (vtMatch) videoTitle = vtMatch[1].trim();

      const vdMatch = vidText.match(/\*\s+\*\*المدة المقترحة:\*\*\s+(\d+)/);
      if (vdMatch) videoDuration = parseInt(vdMatch[1], 10) || 12;

      const voMatch = vidText.match(/\*\s+\*\*الهدف:\*\*\s+([^\n]+)/);
      if (voMatch) videoObjective = voMatch[1].trim();

      const vOutMatch = vidText.match(/\*\s+\*\*مخطط الفيديو:\*\*\s*\n((?:\s+-\s+.*\n?)+)/);
      if (vOutMatch) videoOutline = vOutMatch[1].trim();
    }

    const video: ParsedVideo = {
      code: videoCode,
      title: videoTitle,
      durationMinutes: videoDuration,
      objective: videoObjective,
      outline: videoOutline
    };

    // Extract Concept Cards
    const conceptCards: ParsedConceptCard[] = [];
    const cardsMatch = block.match(/### بطاقات المفاهيم[^]*?\n((?:\d+\..*\n?)+)/);
    if (cardsMatch) {
      const cardLines = cardsMatch[1].split(/\n(?=\d+\.)/);
      for (const cLine of cardLines) {
        const cText = cLine.replace(/^\d+\.\s*/, '').trim();
        const colon = cText.indexOf(':');
        const cTitle = colon !== -1 ? cText.substring(0, colon).trim() : 'مفهوم رئيسي';
        const cBody = colon !== -1 ? cText.substring(colon + 1).trim() : cText;
        conceptCards.push({
          title: cTitle,
          explanation: cBody,
          takeaway: cBody.split(';')[0] || cBody,
          terminology: [cTitle]
        });
      }
    }

    // Extract Engineering Task
    let taskTitle = `المهمة الهندسية: ${officialTitle}`;
    let taskScenario = '';
    let taskRequirements = '';

    const taskMatch = block.match(/### المهمة الهندسية التطبيقية[^]*?(?=###|$)/);
    if (taskMatch) {
      const taskText = taskMatch[0];
      const ttMatch = taskText.match(/\*\s+\*\*العنوان:\*\*\s+`?([^`\n]+)`?/);
      if (ttMatch) taskTitle = ttMatch[1].trim();

      const tsMatch = taskText.match(/\*\s+\*\*السيناريو(?:\s+الهندسي)?:\*\*\s+([^\n]+)/);
      if (tsMatch) taskScenario = tsMatch[1].trim();

      const trMatch = taskText.match(/\*\s+\*\*التعليمات:\*\*\s*\n((?:\s+\d+\..*\n?)+)/);
      if (trMatch) taskRequirements = trMatch[1].trim();
    }

    const task: ParsedTask = {
      code: `${lessonCode}-TASK`,
      title: taskTitle,
      scenario: taskScenario || description,
      requirements: taskRequirements || 'قم بتحليل السيناريو وتقديم الحل الهندسي المكتوب بدقة.',
      taskType: TaskType.DAILY_TASK,
      difficulty: Difficulty.INTERMEDIATE,
      estimatedDurationMinutes: 45,
      xpReward: 30,
      authority: ContentAuthority.PROPOSED
    };

    // Extract Advanced Challenge
    let challengeTitle = `تحدي متقدم: ${officialTitle}`;
    let challengeReqs = '';

    const chMatch = block.match(/### التحدي المتقدم[^]*?(?=###|$)/);
    if (chMatch) {
      const chText = chMatch[0];
      const ctMatch = chText.match(/\*\s+\*\*عنوان التحدي:\*\*\s+`?([^`\n]+)`?/);
      if (ctMatch) challengeTitle = ctMatch[1].trim();

      const crMatch = chText.match(/\*\s+\*\*(?:المسألة|المطلوب):\*\*\s+([^\n]+)/);
      if (crMatch) challengeReqs = crMatch[1].trim();
    }

    const challenge: ParsedChallenge = {
      code: `${lessonCode}-CHALLENGE`,
      title: challengeTitle,
      requirements: challengeReqs || 'مسألة بحثية متقدمة لتعميق الفهم الهندسي للموضوع.',
      taskType: TaskType.CHALLENGE,
      difficulty: Difficulty.ADVANCED,
      estimatedDurationMinutes: 60,
      xpReward: 50,
      authority: ContentAuthority.PROPOSED
    };

    // Extract Quiz & 5 Questions
    const questions: ParsedQuestion[] = [];
    const quizMatch = block.match(/### (?:بنك أسئلة الكويز|مخطط الكويز التفاعلي)[^]*?(?=---|$)/);
    if (quizMatch) {
      const quizText = quizMatch[0];
      // Split by numbered question pattern: \n1. , \n2. , etc.
      const qBlocks = quizText.split(/\n(?=\d+\.\s+)/).slice(1);
      let qOrder = 1;

      for (const qb of qBlocks) {
        const qLines = qb.trim().split('\n');
        const firstLine = qLines[0].replace(/^\d+\.\s*/, '').trim();

        // Determine question type
        let qType = QuestionType.MULTIPLE_CHOICE;
        let isTrueFalse = firstLine.includes('صح أو خطأ');
        if (isTrueFalse) {
          qType = QuestionType.SHORT_ANSWER;
        }

        const questionText = firstLine.replace(/^\*(?:اختيار من متعدد|صح أو خطأ|سيناريو):\*\s*/, '').trim();

        // Options and correct answer
        const options: string[] = [];
        let correctAnswer = '';
        let explanation = '';

        for (let li = 1; li < qLines.length; li++) {
          const l = qLines[li].trim();
          if (l.includes('الإجابة:')) {
            correctAnswer = l.replace(/^[-*]?\s*الإجابة:\s*/, '').trim();
            explanation = correctAnswer;
          } else if (l.includes('[صحيح]')) {
            // Multiple choice option line
            const subOpts = l.split('|').map(s => s.trim());
            for (const o of subOpts) {
              const optClean = o.replace(/^[-*]?\s*/, '').trim();
              if (optClean.includes('[صحيح]')) {
                const answerText = optClean.replace('[صحيح]', '').trim();
                correctAnswer = answerText;
                options.push(answerText);
              } else if (optClean) {
                options.push(optClean);
              }
            }
          } else if (l.startsWith('-') || l.startsWith('*')) {
            const optClean = l.replace(/^[-*]\s*/, '').trim();
            if (optClean) options.push(optClean);
          }
        }

        // If no options were found on true/false, default to standard True/False options
        if (isTrueFalse && options.length === 0) {
          options.push('صح', 'خطأ');
        }

        questions.push({
          questionText: questionText || `سؤال رقم ${qOrder} في ${officialTitle}`,
          questionType: qType,
          options,
          correctAnswer: correctAnswer || (options[0] || 'الإجابة النموذجية'),
          explanation: explanation || 'استناداً إلى المفاهيم الوزارية المعتمدة للدرس.',
          difficulty: qOrder <= 2 ? 'EASY' : qOrder <= 4 ? 'MEDIUM' : 'HARD',
          sourceConcept: coreConcepts[0] || officialTitle,
          marks: 20,
          order: qOrder
        });

        qOrder++;
      }
    }

    const exam: ParsedExam = {
      code: `${lessonCode}-QUIZ`,
      title: `كويز الدرس: ${officialTitle}`,
      description: `الاختبار المعياري التفاعلي للتحقق من استيعاب مخرجات تعلم الدرس ${lessonNumber}`,
      durationMinutes: 15,
      totalMarks: 100,
      xpReward: 30,
      authority: ContentAuthority.PROPOSED,
      questions
    };

    const lesson: ParsedLesson = {
      code: lessonCode,
      lessonNumber,
      order: globalOrder,
      chapterCode,
      chapterTitle,
      officialTitle,
      pageRange: pageRange || 'كتاب الوزارة',
      description,
      learningOutcomes,
      coreConcepts,
      content,
      conceptCards,
      video,
      task,
      challenge,
      exam,
      authority: ContentAuthority.OFFICIAL
    };

    parsedLessons.push(lesson);
    chapters[chapterNum - 1].lessons.push(lesson);
    globalOrder++;
  }

  course.chapters = chapters;

  const totalQuestions = parsedLessons.reduce((sum, l) => sum + l.exam.questions.length, 0);

  return {
    specHash,
    pipelineVersion: PIPELINE_VERSION,
    course,
    totalChapters: chapters.length,
    totalLessons: parsedLessons.length,
    totalVideos: parsedLessons.length,
    totalTasks: parsedLessons.length,
    totalChallenges: parsedLessons.length,
    totalExams: parsedLessons.length,
    totalQuestions
  };
}
