import { prisma } from '../../db/prisma.js';
import {
  CreateLessonInput,
  LinkLessonToSessionInput,
  ListLessonsQuery,
  ReorderLessonsInput,
  UpdateLessonInput,
  conceptCardsDeckSchema,
  ConceptCard
} from './lesson.schema.js';
import { AppError, BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { AttendanceStatus, LessonAccessType, Role, StudentGrade, ContentAuthority } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service.js';
import { canAccessLesson, LOCKED_EXPLANATION_AR } from './lesson-access.service.js';
import { getStudentGrade, assertGradeAccess } from '../curriculum/curriculum-auth.js';

function resolveConceptCards(rawCards: any, authority: string): ConceptCard[] {
  if (rawCards === null || rawCards === undefined) {
    return [];
  }

  let parsedData = rawCards;
  if (typeof rawCards === 'string') {
    try {
      parsedData = JSON.parse(rawCards);
    } catch (err) {
      if (authority === 'OFFICIAL') {
        throw new AppError('OFFICIAL_CURRICULUM_CORRUPTION: Invalid JSON in official conceptCards', 500);
      }
      return [];
    }
  }

  if (!Array.isArray(parsedData)) {
    if (authority === 'OFFICIAL') {
      throw new AppError('OFFICIAL_CURRICULUM_CORRUPTION: ConceptCards must be an array', 500);
    }
    return [];
  }

  const parseResult = conceptCardsDeckSchema.safeParse(parsedData);
  if (!parseResult.success) {
    if (authority === 'OFFICIAL') {
      throw new AppError(`OFFICIAL_CURRICULUM_CORRUPTION: ${parseResult.error.message}`, 500);
    }
    return [];
  }

  return parseResult.data;
}


export async function createLesson(input: CreateLessonInput, actorUserId?: string) {
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: input.curriculumId }
  });

  if (!curriculum) {
    throw new NotFoundError('Curriculum not found');
  }

  if (input.sectionId) {
    const section = await prisma.section.findUnique({
      where: { id: input.sectionId }
    });
    if (!section || section.curriculumId !== input.curriculumId) {
      throw new BadRequestError('Section does not exist or does not belong to this curriculum');
    }
  }

  const lesson = await prisma.lesson.create({
    data: {
      curriculumId: input.curriculumId,
      sectionId: input.sectionId || null,
      title: input.title,
      description: input.description ?? null,
      content: input.content,
      difficulty: input.difficulty,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      pageRange: input.pageRange !== undefined ? (input.pageRange || null) : undefined,
      authority: input.authority || ContentAuthority.OFFICIAL,
      conceptCards: input.conceptCards !== undefined ? (typeof input.conceptCards === 'string' ? JSON.parse(input.conceptCards) : input.conceptCards) : undefined,
      order: input.order,
      isPublished: input.isPublished,
      isFree: input.isFree ?? false,
      accessType: input.accessType || (input.isFree ? LessonAccessType.FREE : LessonAccessType.SUBSCRIPTION_REQUIRED),
      videoUrl: input.videoUrl || null,
      videoDurationSeconds: input.videoDurationSeconds ?? null,
      videoId: input.videoId ?? null,
      externalResourceUrl: input.externalResourceUrl || null,
      externalResourceTitle: input.externalResourceTitle || null,
      sessionLessons: input.sessionIds && input.sessionIds.length > 0
        ? {
            create: input.sessionIds.map((sessionId, index) => ({
              sessionId,
              order: index + 1
            }))
          }
        : undefined
    },
    include: {
      curriculum: true,
      section: true,
      video: true,
      sessionLessons: { include: { session: true } }
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'LESSON_CREATED',
    entityType: 'Lesson',
    entityId: lesson.id,
    metadata: { title: lesson.title, curriculumId: input.curriculumId, sectionId: input.sectionId }
  });

  return lesson;
}

export async function listLessons(
  query: ListLessonsQuery,
  requestUser: { userId: string; role: Role; studentId?: string }
) {
  let studentGrade: StudentGrade | undefined;
  if (requestUser.role === Role.STUDENT) {
    if (!requestUser.studentId) {
      return [];
    }
    const resolved = await getStudentGrade(requestUser.studentId);
    if (!resolved) {
      return [];
    }
    studentGrade = resolved;
  }

  const where = {
    isPublished: requestUser.role === Role.ADMIN ? undefined : true,
    ...(query.curriculumId ? { curriculumId: query.curriculumId } : {}),
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    ...(query.difficulty ? { difficulty: query.difficulty } : {}),
    ...(requestUser.role === Role.STUDENT && studentGrade ? { curriculum: { grade: studentGrade } } : {})
  };

  const lessons = await prisma.lesson.findMany({
    where,
    orderBy: [{ curriculumId: 'asc' }, { order: 'asc' }],
    include: {
      curriculum: { select: { id: true, code: true, title: true, type: true, authority: true, grade: true } },
      section: { select: { id: true, code: true, title: true, order: true, authority: true } },
      sessionLessons: { select: { sessionId: true } },
      _count: { select: { tasks: true } }
    }
  });

  // If Student, annotate each lesson with locked/unlocked state and progress
  if (requestUser.role === Role.STUDENT && requestUser.studentId) {
    const studentId = requestUser.studentId;
    const now = new Date();

    const [studentProgressRecords, activeGrants, activeSub] = await Promise.all([
      prisma.studentLessonProgress.findMany({
        where: { studentId },
        select: {
          lessonId: true,
          status: true,
          progressPercentage: true,
          lastWatchedPosition: true
        }
      }),
      prisma.educationalAccessGrant.findMany({
        where: {
          studentId,
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gte: now } }]
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.subscription.findFirst({
        where: {
          studentId,
          status: 'ACTIVE',
          currentPeriodEnd: { gte: now }
        }
      })
    ]);

    const progressMap = new Map(studentProgressRecords.map((p) => [p.lessonId, p]));
    const hasActiveSub = Boolean(activeSub);

    return lessons.map((lesson: any) => {
      const isFree = Boolean(lesson.isFree || lesson.accessType === LessonAccessType.FREE);
      let canAccess = isFree;
      let reason: string | null = isFree ? 'FREE_PREVIEW' : null;

      if (!canAccess) {
        const matchingGrant = activeGrants.find((g) => {
          if (g.scope === 'ALL_ACCESS') return true;
          if (g.scope === 'COURSE' && lesson.curriculumId && g.curriculumId === lesson.curriculumId) return true;
          if (g.scope === 'LESSON' && g.lessonId === lesson.id) return true;
          return false;
        });

        if (matchingGrant) {
          canAccess = true;
          reason = 'ADMIN_GRANTED';
        } else if (hasActiveSub) {
          canAccess = true;
          reason = 'ACTIVE_SUBSCRIPTION';
        } else {
          canAccess = false;
          reason = 'SUBSCRIPTION_REQUIRED';
        }
      }

      const isLocked = !canAccess;
      const progress = progressMap.get(lesson.id) || null;

      return {
        id: lesson.id,
        curriculumId: lesson.curriculumId,
        curriculum: lesson.curriculum,
        sectionId: lesson.sectionId,
        section: lesson.section,
        code: lesson.code,
        title: lesson.title,
        description: lesson.description,
        pageRange: lesson.pageRange,
        authority: lesson.authority,
        difficulty: lesson.difficulty,
        estimatedDurationMinutes: lesson.estimatedDurationMinutes,
        order: lesson.order,
        isPublished: lesson.isPublished,
        isFree: lesson.isFree,
        accessType: lesson.accessType,
        videoUrl: isLocked ? null : lesson.videoUrl,
        videoDurationSeconds: lesson.videoDurationSeconds,
        taskCount: lesson._count.tasks,
        isLocked,
        lockReason: reason || (isLocked ? 'SUBSCRIPTION_REQUIRED' : null),
        lockMessage: isLocked ? LOCKED_EXPLANATION_AR : null,
        progress: progress
          ? {
              status: progress.status,
              progressPercentage: progress.progressPercentage,
              lastWatchedPosition: progress.lastWatchedPosition
            }
          : null
      };
    });
  }

  return lessons.map((lesson: any) => ({
    id: lesson.id,
    curriculumId: lesson.curriculumId,
    curriculum: lesson.curriculum,
    sectionId: lesson.sectionId,
    section: lesson.section,
    code: lesson.code,
    title: lesson.title,
    description: lesson.description,
    pageRange: lesson.pageRange,
    authority: lesson.authority,
    difficulty: lesson.difficulty,
    estimatedDurationMinutes: lesson.estimatedDurationMinutes,
    order: lesson.order,
    isPublished: lesson.isPublished,
    isFree: lesson.isFree,
    accessType: lesson.accessType,
    videoUrl: lesson.videoUrl,
    videoDurationSeconds: lesson.videoDurationSeconds,
    taskCount: lesson._count.tasks,
    isLocked: false,
    lockReason: null,
    lockMessage: null
  }));
}

export async function getLessonById(
  lessonId: string,
  requestUser: { userId: string; role: Role; studentId?: string }
) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      curriculum: true,
      section: true,
      video: true,
      sessionLessons: {
        include: { session: true }
      },
      tasks: {
        where: requestUser.role === Role.ADMIN ? undefined : { isPublished: true },
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          instructions: true,
          taskType: true,
          difficulty: true,
          xpReward: true,
          authority: true,
          isPublished: true
        }
      },
      exams: {
        where: requestUser.role === Role.ADMIN ? undefined : { isPublished: true },
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          durationMinutes: true,
          totalMarks: true,
          xpReward: true,
          isQuiz: true,
          authority: true,
          isPublished: true
        }
      }
    }
  });

  if (!lesson) {
    throw new NotFoundError('Lesson not found');
  }

  // Find next sequential lesson in this course
  const nextLesson = await prisma.lesson.findFirst({
    where: {
      curriculumId: lesson.curriculumId,
      isPublished: true,
      order: { gt: lesson.order }
    },
    orderBy: { order: 'asc' },
    select: { id: true, title: true, order: true }
  });

  if (requestUser.role === Role.STUDENT && requestUser.studentId) {
    // 1. Grade Isolation: strictly hide other grade's lessons (404 Not Found)
    const studentGrade = await getStudentGrade(requestUser.studentId);
    assertGradeAccess(studentGrade, lesson.curriculum.grade, 'Lesson');

    // 2. Financial / Access Entitlement (Separate concept)
    const studentId = requestUser.studentId;
    const access = await canAccessLesson(requestUser, lesson);
    const isLocked = !access.canAccess;
    const lockReason = access.reason || (isLocked ? 'SUBSCRIPTION_REQUIRED' : null);
    const lockMessage = isLocked ? (access.messageAr || LOCKED_EXPLANATION_AR) : null;

    const progressRecord = await prisma.studentLessonProgress.findUnique({
      where: {
        studentId_lessonId: {
          studentId,
          lessonId
        }
      }
    });

    if (isLocked) {
      return {
        id: lesson.id,
        curriculumId: lesson.curriculumId,
        curriculum: lesson.curriculum
          ? {
              id: lesson.curriculum.id,
              code: lesson.curriculum.code,
              title: lesson.curriculum.title,
              description: lesson.curriculum.description,
              type: lesson.curriculum.type,
              track: lesson.curriculum.track,
              academicYear: lesson.curriculum.academicYear,
              term: lesson.curriculum.term,
              authority: lesson.curriculum.authority
            }
          : null,
        sectionId: lesson.sectionId,
        section: lesson.section
          ? {
              id: lesson.section.id,
              code: lesson.section.code,
              title: lesson.section.title,
              order: lesson.section.order,
              authority: lesson.section.authority
            }
          : null,
        code: lesson.code,
        title: lesson.title,
        description: lesson.description,
        content: null, // Locked - content shielded
        conceptCards: null, // Locked - concept cards shielded
        pageRange: lesson.pageRange,
        authority: lesson.authority,
        difficulty: lesson.difficulty,
        estimatedDurationMinutes: lesson.estimatedDurationMinutes,
        order: lesson.order,
        isPublished: lesson.isPublished,
        isFree: lesson.isFree,
        accessType: lesson.accessType,
        videoUrl: null, // Locked - video URL shielded
        videoDurationSeconds: lesson.videoDurationSeconds,
        videoId: null, // Locked - video asset shielded
        video: null, // Locked - video asset shielded
        videoBlueprint: null, // Locked - video blueprint shielded
        isLocked: true,
        lockReason,
        lockMessage,
        tasks: [],
        exams: [],
        engineeringTask: null,
        advancedChallenge: null,
        quiz: null,
        nextSteps: null,
        progress: progressRecord
      };
    }

    // Decorate tasks with student submission status
    const taskSubmissions = await prisma.submission.findMany({
      where: {
        studentId,
        taskId: { in: lesson.tasks.map((t) => t.id) }
      },
      select: {
        id: true,
        taskId: true,
        status: true,
        feedback: true,
        content: true,
        fileUrl: true,
        githubUrl: true,
        submittedAt: true
      }
    });
    const subMap = new Map(taskSubmissions.map((s) => [s.taskId, s]));
    const enrichedTasks = lesson.tasks.map((t) => ({
      ...t,
      mySubmission: subMap.get(t.id) || null
    }));

    // Decorate exams with student attempt status
    const examAttempts = await prisma.examAttempt.findMany({
      where: {
        studentId,
        examId: { in: lesson.exams.map((e) => e.id) }
      },
      select: {
        examId: true,
        score: true,
        percentage: true,
        xpEarned: true,
        submittedAt: true
      }
    });
    const attemptMap = new Map(examAttempts.map((a) => [a.examId, a]));
    const enrichedExams = lesson.exams.map((e) => ({
      ...e,
      myAttempt: attemptMap.get(e.id) || null
    }));

    const resolvedCards = resolveConceptCards(lesson.conceptCards, lesson.authority);
    const engineeringTask = enrichedTasks.find((t) => t.taskType === 'DAILY_TASK') || null;
    const advancedChallenge = enrichedTasks.find((t) => t.taskType === 'CHALLENGE') || null;
    const quiz = enrichedExams.find((e) => e.isQuiz) || null;
    const videoBlueprint = lesson.video
      ? {
          id: lesson.video.id,
          code: lesson.video.code,
          provider: lesson.video.provider,
          providerVideoId: lesson.video.providerVideoId,
          title: lesson.video.title,
          durationSeconds: lesson.video.durationSeconds,
          thumbnailUrl: lesson.video.thumbnailUrl,
          playbackUrl: lesson.video.playbackUrl,
          authority: lesson.video.authority,
          metadata: lesson.video.metadata
        }
      : null;

    const nextSteps = {
      quiz,
      exam: enrichedExams.find((e) => !e.isQuiz) || null,
      task: engineeringTask || enrichedTasks.find((t) => t.taskType !== 'PROJECT') || null,
      project: enrichedTasks.find((t) => t.taskType === 'PROJECT') || null,
      nextLesson: nextLesson || null
    };

    return {
      ...lesson,
      conceptCards: resolvedCards,
      videoBlueprint,
      engineeringTask,
      advancedChallenge,
      quiz,
      isLocked: false,
      lockReason: null,
      lockMessage: null,
      tasks: enrichedTasks,
      exams: enrichedExams,
      nextSteps,
      progress: progressRecord
    };
  }

  const resolvedCards = resolveConceptCards(lesson.conceptCards, lesson.authority);
  const engineeringTask = lesson.tasks.find((t: any) => t.taskType === 'DAILY_TASK') || null;
  const advancedChallenge = lesson.tasks.find((t: any) => t.taskType === 'CHALLENGE') || null;
  const quiz = lesson.exams.find((e: any) => e.isQuiz) || null;
  const videoBlueprint = lesson.video
    ? {
        id: lesson.video.id,
        code: lesson.video.code,
        provider: lesson.video.provider,
        providerVideoId: lesson.video.providerVideoId,
        title: lesson.video.title,
        durationSeconds: lesson.video.durationSeconds,
        thumbnailUrl: lesson.video.thumbnailUrl,
        playbackUrl: lesson.video.playbackUrl,
        authority: lesson.video.authority,
        metadata: lesson.video.metadata
      }
    : null;

  const nextSteps = {
    quiz,
    exam: lesson.exams.find((e: any) => !e.isQuiz) || null,
    task: engineeringTask || lesson.tasks.find((t: any) => t.taskType !== 'PROJECT') || null,
    project: lesson.tasks.find((t: any) => t.taskType === 'PROJECT') || null,
    nextLesson: nextLesson || null
  };

  return {
    ...lesson,
    conceptCards: resolvedCards,
    videoBlueprint,
    engineeringTask,
    advancedChallenge,
    quiz,
    isLocked: false,
    lockReason: null,
    nextSteps
  };
}

export async function linkLessonToSession(
  lessonId: string,
  input: LinkLessonToSessionInput,
  actorUserId?: string
) {
  const [lesson, session] = await Promise.all([
    prisma.lesson.findUnique({ where: { id: lessonId } }),
    prisma.session.findUnique({ where: { id: input.sessionId } })
  ]);

  if (!lesson) throw new NotFoundError('Lesson not found');
  if (!session) throw new NotFoundError('Session not found');

  const link = await prisma.sessionLesson.upsert({
    where: {
      sessionId_lessonId: {
        sessionId: input.sessionId,
        lessonId
      }
    },
    create: {
      sessionId: input.sessionId,
      lessonId,
      order: input.order
    },
    update: {
      order: input.order
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'LESSON_LINKED_TO_SESSION',
    entityType: 'SessionLesson',
    entityId: link.id,
    metadata: { lessonId, sessionId: input.sessionId }
  });

  return link;
}

export async function updateLesson(
  lessonId: string,
  input: UpdateLessonInput,
  actorUserId?: string
) {
  const existing = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!existing) throw new NotFoundError('Lesson not found');

  if (input.sectionId) {
    const targetCurriculumId = input.curriculumId || existing.curriculumId;
    const section = await prisma.section.findUnique({ where: { id: input.sectionId } });
    if (!section || section.curriculumId !== targetCurriculumId) {
      throw new BadRequestError('Section does not belong to this curriculum');
    }
  }

  const updated = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      curriculumId: input.curriculumId,
      sectionId: input.sectionId !== undefined ? input.sectionId : undefined,
      title: input.title,
      description: input.description !== undefined ? input.description : undefined,
      content: input.content,
      pageRange: input.pageRange !== undefined ? (input.pageRange || null) : undefined,
      authority: input.authority !== undefined ? input.authority : undefined,
      conceptCards: input.conceptCards !== undefined ? (typeof input.conceptCards === 'string' ? JSON.parse(input.conceptCards) : input.conceptCards) : undefined,
      difficulty: input.difficulty,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      order: input.order,
      isPublished: input.isPublished,
      isFree: input.isFree !== undefined ? input.isFree : undefined,
      accessType: input.accessType !== undefined ? input.accessType : undefined,
      videoUrl: input.videoUrl !== undefined ? (input.videoUrl || null) : undefined,
      videoDurationSeconds: input.videoDurationSeconds !== undefined ? input.videoDurationSeconds : undefined,
      videoId: input.videoId !== undefined ? (input.videoId || null) : undefined,
      externalResourceUrl: input.externalResourceUrl !== undefined ? (input.externalResourceUrl || null) : undefined,
      externalResourceTitle: input.externalResourceTitle !== undefined ? (input.externalResourceTitle || null) : undefined
    },
    include: {
      curriculum: true,
      section: true,
      video: true
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'LESSON_UPDATED',
    entityType: 'Lesson',
    entityId: lessonId,
    metadata: { changed: input }
  });

  return updated;
}

export async function reorderLessons(
  input: ReorderLessonsInput,
  actorUserId?: string
) {
  await prisma.$transaction(
    input.items.map((item) =>
      prisma.lesson.update({
        where: { id: item.id },
        data: {
          order: item.order,
          ...(item.sectionId !== undefined ? { sectionId: item.sectionId } : {})
        }
      })
    )
  );

  await createAuditLog({
    actorUserId,
    action: 'LESSONS_REORDERED',
    entityType: 'Lesson',
    entityId: input.items[0]?.id || 'bulk',
    metadata: { count: input.items.length }
  });

  return { success: true };
}

export async function deleteLesson(lessonId: string, actorUserId?: string) {
  const existing = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      _count: { select: { tasks: true, sessionLessons: true } }
    }
  });
  if (!existing) throw new NotFoundError('Lesson not found');

  if (existing._count.tasks > 0) {
    throw new BadRequestError('Cannot delete lesson with existing tasks. Remove or reassign tasks first.');
  }

  await prisma.lesson.delete({ where: { id: lessonId } });

  await createAuditLog({
    actorUserId,
    action: 'LESSON_DELETED',
    entityType: 'Lesson',
    entityId: lessonId,
    metadata: { title: existing.title }
  });

  return { success: true };
}

export async function bulkPublishLessons(
  ids: string[],
  isPublished: boolean,
  actorUserId?: string
) {
  const result = await prisma.lesson.updateMany({
    where: { id: { in: ids } },
    data: { isPublished }
  });

  await createAuditLog({
    actorUserId,
    action: isPublished ? 'LESSONS_BULK_PUBLISHED' : 'LESSONS_BULK_UNPUBLISHED',
    entityType: 'Lesson',
    entityId: ids[0] || null,
    metadata: { count: result.count, ids, isPublished }
  });

  return {
    success: true,
    count: result.count,
    ids
  };
}

export async function bulkDeleteLessons(
  ids: string[],
  actorUserId?: string
) {
  const successful: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const id of ids) {
    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id },
        include: {
          curriculum: true,
          _count: { select: { tasks: true, sessionLessons: true } }
        }
      });

      if (!lesson) {
        failed.push({ id, reason: 'Lesson not found' });
        continue;
      }

      if (lesson.authority === 'OFFICIAL' || lesson.curriculum?.authority === 'OFFICIAL') {
        failed.push({ id, reason: `Cannot delete official curriculum lesson "${lesson.title}". Official lessons are permanently protected.` });
        continue;
      }

      if (lesson._count.tasks > 0) {
        failed.push({ id, reason: `Cannot delete lesson "${lesson.title}" because it has ${lesson._count.tasks} existing tasks.` });
        continue;
      }

      await prisma.lesson.delete({ where: { id } });
      successful.push(id);
    } catch (err: any) {
      failed.push({ id, reason: err.message || 'Deletion failed' });
    }
  }

  await createAuditLog({
    actorUserId,
    action: 'LESSONS_BULK_DELETED',
    entityType: 'Lesson',
    entityId: ids[0] || null,
    metadata: { successfulCount: successful.length, failedCount: failed.length }
  });

  return {
    success: failed.length === 0,
    successful,
    failed
  };
}
