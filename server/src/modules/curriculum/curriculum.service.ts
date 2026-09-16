import { prisma } from '../../db/prisma.js';
import { CreateCurriculumInput, ListCurriculumQuery, UpdateCurriculumInput } from './curriculum.schema.js';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { createAuditLog } from '../audit/audit.service.js';
import { Role, StudentGrade } from '@prisma/client';
import { canAccessLesson, LOCKED_EXPLANATION_AR } from '../lessons/lesson-access.service.js';
import { getStudentGrade, assertGradeAccess } from './curriculum-auth.js';

export async function createCurriculum(input: CreateCurriculumInput, actorUserId?: string) {
  const curriculum = await prisma.curriculum.create({
    data: {
      title: input.title,
      description: input.description,
      type: input.type,
      track: input.track,
      grade: input.grade || StudentGrade.GRADE_2,
      isPublished: input.isPublished
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'CURRICULUM_CREATED',
    entityType: 'Curriculum',
    entityId: curriculum.id,
    metadata: { title: curriculum.title, type: curriculum.type, grade: curriculum.grade }
  });

  return curriculum;
}

export async function listCurricula(
  query: ListCurriculumQuery,
  requestUser?: { userId: string; role: Role; studentId?: string }
) {
  let studentGrade: StudentGrade | null = null;
  if (requestUser?.role === Role.STUDENT && requestUser.studentId) {
    studentGrade = await getStudentGrade(requestUser.studentId);
    if (!studentGrade) {
      return [];
    }
  }

  const where = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.track ? { track: query.track } : {}),
    ...(requestUser?.role === Role.STUDENT
      ? { isPublished: true, grade: studentGrade }
      : query.grade
      ? { grade: query.grade }
      : {})
  };

  return prisma.curriculum.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: { lessons: true, sections: true, exams: true }
      }
    }
  });
}

export async function getCurriculumById(
  id: string,
  requestUser?: { userId: string; role: Role; studentId?: string }
) {
  const curriculum = await prisma.curriculum.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { order: 'asc' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              sectionId: true,
              code: true,
              title: true,
              description: true,
              pageRange: true,
              authority: true,
              difficulty: true,
              estimatedDurationMinutes: true,
              order: true,
              isPublished: true,
              isFree: true,
              accessType: true,
              videoUrl: true,
              videoDurationSeconds: true,
              sessionLessons: { select: { sessionId: true } },
              tasks: {
                select: { id: true, code: true, title: true, taskType: true, difficulty: true, xpReward: true, authority: true }
              },
              exams: {
                select: { id: true, code: true, title: true, durationMinutes: true, totalMarks: true, xpReward: true, isQuiz: true, authority: true }
              }
            }
          }
        }
      },
      lessons: {
        orderBy: { order: 'asc' },
        include: {
          section: {
            select: { id: true, code: true, title: true, order: true, authority: true }
          },
          sessionLessons: { select: { sessionId: true } },
          tasks: {
            where: { isPublished: true },
            select: { id: true, code: true, title: true, taskType: true, difficulty: true, xpReward: true, authority: true }
          }
        }
      },
      exams: {
        where: { isPublished: true },
        select: { id: true, code: true, title: true, durationMinutes: true, totalMarks: true, xpReward: true, isQuiz: true, authority: true }
      }
    }
  });

  if (!curriculum) {
    throw new NotFoundError('Curriculum not found');
  }

  // Strictly enforce grade isolation for students
  if (requestUser?.role === Role.STUDENT && requestUser.studentId) {
    const studentGrade = await getStudentGrade(requestUser.studentId);
    assertGradeAccess(studentGrade, curriculum.grade, 'Curriculum');
  }

  // If student user, evaluate access and progress for each lesson
  if (requestUser?.role === Role.STUDENT && requestUser.studentId) {
    const studentId = requestUser.studentId;
    const progressRecords = await prisma.studentLessonProgress.findMany({
      where: { studentId }
    });
    const progressMap = new Map(progressRecords.map((p) => [p.lessonId, p]));

    const annotateLesson = async (lesson: any) => {
      const access = await canAccessLesson(requestUser, lesson);
      const isLocked = !access.canAccess;
      const progress = progressMap.get(lesson.id) || null;

      return {
        id: lesson.id,
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
        isLocked,
        lockReason: access.reason || (isLocked ? 'ATTENDANCE_REQUIRED' : null),
        lockMessage: isLocked ? (access.messageAr || LOCKED_EXPLANATION_AR) : null,
        tasks: isLocked ? [] : lesson.tasks,
        progress: progress
          ? {
              status: progress.status,
              progressPercentage: progress.progressPercentage,
              lastWatchedPosition: progress.lastWatchedPosition
            }
          : null
      };
    };

    const annotatedSections = await Promise.all(
      curriculum.sections.map(async (sec) => {
        const secLessons = await Promise.all(sec.lessons.map(annotateLesson));
        return {
          ...sec,
          lessons: secLessons
        };
      })
    );

    const annotatedLessons = await Promise.all(curriculum.lessons.map(annotateLesson));

    return {
      ...curriculum,
      sections: annotatedSections,
      lessons: annotatedLessons
    };
  }

  return curriculum;
}

export async function getStudentCoursesSummary(studentId: string) {
  const studentGrade = await getStudentGrade(studentId);
  if (!studentGrade) {
    return [];
  }

  const curricula = await prisma.curriculum.findMany({
    where: { isPublished: true, grade: studentGrade },
    orderBy: { createdAt: 'asc' },
    include: {
      sections: {
        where: { isPublished: true },
        orderBy: { order: 'asc' },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              order: true,
              isFree: true,
              accessType: true,
              estimatedDurationMinutes: true,
              videoUrl: true,
              videoDurationSeconds: true,
              sessionLessons: { select: { sessionId: true } }
            }
          }
        }
      },
      lessons: {
        where: { isPublished: true },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          sectionId: true,
          title: true,
          order: true,
          isFree: true,
          accessType: true,
          estimatedDurationMinutes: true,
          videoUrl: true,
          videoDurationSeconds: true,
          sessionLessons: { select: { sessionId: true } }
        }
      }
    }
  });

  const progressRecords = await prisma.studentLessonProgress.findMany({
    where: { studentId }
  });
  const progressMap = new Map(progressRecords.map((p) => [p.lessonId, p]));

  return Promise.all(
    curricula.map(async (course) => {
      const allLessons = course.lessons;
      const totalLessons = allLessons.length;
      let completedLessons = 0;
      let nextLesson: any = null;
      let continueLesson: any = null;

      for (const lesson of allLessons) {
        const p = progressMap.get(lesson.id);
        if (p?.status === 'COMPLETED') {
          completedLessons++;
        } else if (!nextLesson) {
          nextLesson = lesson;
          if (p?.status === 'IN_PROGRESS') {
            continueLesson = {
              lessonId: lesson.id,
              title: lesson.title,
              lastWatchedPosition: p.lastWatchedPosition,
              progressPercentage: p.progressPercentage
            };
          }
        }
      }

      if (!continueLesson && nextLesson) {
        continueLesson = {
          lessonId: nextLesson.id,
          title: nextLesson.title,
          lastWatchedPosition: 0,
          progressPercentage: 0
        };
      }

      const percentage = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

      return {
        id: course.id,
        code: course.code,
        title: course.title,
        description: course.description,
        type: course.type,
        track: course.track,
        academicYear: course.academicYear,
        term: course.term,
        authority: course.authority,
        totalLessons,
        completedLessons,
        percentage,
        sectionsCount: course.sections.length,
        continueLesson
      };
    })
  );
}

export async function updateCurriculum(
  id: string,
  input: UpdateCurriculumInput,
  actorUserId?: string
) {
  const existing = await prisma.curriculum.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Curriculum not found');

  const updated = await prisma.curriculum.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description !== undefined ? input.description : undefined,
      type: input.type,
      track: input.track !== undefined ? input.track : undefined,
      grade: input.grade !== undefined ? input.grade : undefined,
      isPublished: input.isPublished
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'CURRICULUM_UPDATED',
    entityType: 'Curriculum',
    entityId: id,
    metadata: { changed: input }
  });

  return updated;
}

export async function deleteCurriculaBulk(curriculumIds: string[], actorUserId?: string) {
  if (!curriculumIds || curriculumIds.length === 0) {
    return { success: true, count: 0, ids: [] };
  }

  const curricula = await prisma.curriculum.findMany({
    where: { id: { in: curriculumIds } },
    select: { id: true, code: true, title: true, authority: true }
  });

  // Protect official curriculum from accidental deletion
  for (const c of curricula) {
    if (c.code === 'G11-T1-EB-2026' || (c.authority === 'OFFICIAL' && c.code?.startsWith('G11'))) {
      throw new BadRequestError(`The official curriculum ("${c.title}") is protected and cannot be deleted.`);
    }
  }

  const deletableCurriculaIds = curricula.map((c) => c.id);
  if (deletableCurriculaIds.length === 0) {
    return { success: true, count: 0, ids: [] };
  }

  await prisma.$transaction(async (tx) => {
    // 1. Find lessons under these curricula
    const lessons = await tx.lesson.findMany({
      where: { curriculumId: { in: deletableCurriculaIds } },
      select: { id: true }
    });
    const lessonIds = lessons.map((l) => l.id);

    // 2. Tasks under these lessons
    if (lessonIds.length > 0) {
      const tasks = await tx.task.findMany({
        where: { lessonId: { in: lessonIds } },
        select: { id: true }
      });
      const taskIds = tasks.map((t) => t.id);

      if (taskIds.length > 0) {
        await tx.submission.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskAssignment.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.task.deleteMany({ where: { id: { in: taskIds } } });
      }
    }

    // 3. Exams under these curricula or lessons
    const exams = await tx.exam.findMany({
      where: {
        OR: [
          { curriculumId: { in: deletableCurriculaIds } },
          ...(lessonIds.length > 0 ? [{ lessonId: { in: lessonIds } }] : [])
        ]
      },
      select: { id: true }
    });
    const examIds = exams.map((e) => e.id);

    if (examIds.length > 0) {
      await tx.examAttempt.deleteMany({ where: { examId: { in: examIds } } });
      await tx.examQuestion.deleteMany({ where: { examId: { in: examIds } } });
      await tx.exam.deleteMany({ where: { id: { in: examIds } } });
    }

    // 4. Educational access grants
    await tx.educationalAccessGrant.deleteMany({
      where: {
        OR: [
          { curriculumId: { in: deletableCurriculaIds } },
          ...(lessonIds.length > 0 ? [{ lessonId: { in: lessonIds } }] : [])
        ]
      }
    });

    // 5. Progress, session links, and lessons
    if (lessonIds.length > 0) {
      await tx.studentLessonProgress.deleteMany({ where: { lessonId: { in: lessonIds } } });
      await tx.sessionLesson.deleteMany({ where: { lessonId: { in: lessonIds } } });
      await tx.lesson.deleteMany({ where: { id: { in: lessonIds } } });
    }

    // 6. Sections
    await tx.section.deleteMany({ where: { curriculumId: { in: deletableCurriculaIds } } });

    // 7. Curricula
    await tx.curriculum.deleteMany({ where: { id: { in: deletableCurriculaIds } } });
  });

  await createAuditLog({
    actorUserId,
    action: 'CURRICULUM_BULK_DELETED',
    entityType: 'Curriculum',
    entityId: deletableCurriculaIds[0] || null,
    metadata: {
      deletedCount: deletableCurriculaIds.length,
      deletedIds: deletableCurriculaIds,
      titles: curricula.map((c) => c.title)
    }
  });

  return {
    success: true,
    count: deletableCurriculaIds.length,
    deletedCount: deletableCurriculaIds.length,
    ids: deletableCurriculaIds,
    deletedIds: deletableCurriculaIds
  };
}

export async function deleteCurriculum(id: string, actorUserId?: string) {
  const existing = await prisma.curriculum.findUnique({
    where: { id },
    select: { id: true, code: true, title: true, authority: true }
  });
  if (!existing) throw new NotFoundError('Curriculum not found');

  if (existing.code === 'G11-T1-EB-2026' || (existing.authority === 'OFFICIAL' && existing.code?.startsWith('G11'))) {
    throw new BadRequestError(`The official curriculum ("${existing.title}") is protected and cannot be deleted.`);
  }

  await deleteCurriculaBulk([id], actorUserId);
  return { success: true };
}

