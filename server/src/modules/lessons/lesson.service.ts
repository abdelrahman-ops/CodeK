import { prisma } from '../../db/prisma.js';
import {
  CreateLessonInput,
  LinkLessonToSessionInput,
  ListLessonsQuery,
  UpdateLessonInput
} from './lesson.schema.js';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { AttendanceStatus, Role } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service.js';

export async function createLesson(input: CreateLessonInput, actorUserId?: string) {
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: input.curriculumId }
  });

  if (!curriculum) {
    throw new NotFoundError('Curriculum not found');
  }

  const lesson = await prisma.lesson.create({
    data: {
      curriculumId: input.curriculumId,
      title: input.title,
      description: input.description,
      content: input.content,
      difficulty: input.difficulty,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      order: input.order,
      isPublished: input.isPublished,
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
      sessionLessons: { include: { session: true } }
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'LESSON_CREATED',
    entityType: 'Lesson',
    entityId: lesson.id,
    metadata: { title: lesson.title, curriculumId: input.curriculumId }
  });

  return lesson;
}

export async function listLessons(
  query: ListLessonsQuery,
  requestUser: { userId: string; role: Role; studentId?: string }
) {
  const where = {
    isPublished: requestUser.role === Role.ADMIN ? undefined : true,
    ...(query.curriculumId ? { curriculumId: query.curriculumId } : {}),
    ...(query.difficulty ? { difficulty: query.difficulty } : {})
  };

  const lessons = await prisma.lesson.findMany({
    where,
    orderBy: [{ curriculumId: 'asc' }, { order: 'asc' }],
    include: {
      curriculum: { select: { id: true, title: true, type: true } },
      sessionLessons: { select: { sessionId: true } },
      _count: { select: { tasks: true } }
    }
  });

  // If Student, annotate each lesson with locked/unlocked state
  if (requestUser.role === Role.STUDENT && requestUser.studentId) {
    const studentId = requestUser.studentId;

    const presentAttendances = await prisma.attendance.findMany({
      where: {
        studentId,
        status: AttendanceStatus.PRESENT
      },
      select: { sessionId: true }
    });

    const attendedSessionIds = new Set(presentAttendances.map((a: any) => a.sessionId));

    return lessons.map((lesson: any) => {
      const linkedSessionIds = lesson.sessionLessons.map((sl: any) => sl.sessionId);
      const isLinkedToSession = linkedSessionIds.length > 0;
      const hasAttended = isLinkedToSession
        ? linkedSessionIds.some((sId: string) => attendedSessionIds.has(sId))
        : true;

      return {
        id: lesson.id,
        curriculumId: lesson.curriculumId,
        curriculum: lesson.curriculum,
        title: lesson.title,
        description: lesson.description,
        difficulty: lesson.difficulty,
        estimatedDurationMinutes: lesson.estimatedDurationMinutes,
        order: lesson.order,
        isPublished: lesson.isPublished,
        taskCount: lesson._count.tasks,
        isLocked: !hasAttended,
        lockReason: !hasAttended ? 'ATTENDANCE_REQUIRED' : null
      };
    });
  }

  return lessons.map((lesson: any) => ({
    id: lesson.id,
    curriculumId: lesson.curriculumId,
    curriculum: lesson.curriculum,
    title: lesson.title,
    description: lesson.description,
    difficulty: lesson.difficulty,
    estimatedDurationMinutes: lesson.estimatedDurationMinutes,
    order: lesson.order,
    isPublished: lesson.isPublished,
    taskCount: lesson._count.tasks,
    isLocked: false,
    lockReason: null
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
      sessionLessons: {
        include: { session: true }
      },
      tasks: {
        where: { isPublished: true },
        select: {
          id: true,
          title: true,
          description: true,
          taskType: true,
          difficulty: true,
          xpReward: true
        }
      }
    }
  });

  if (!lesson) {
    throw new NotFoundError('Lesson not found');
  }

  if (requestUser.role === Role.STUDENT && requestUser.studentId) {
    const studentId = requestUser.studentId;
    const linkedSessionIds = lesson.sessionLessons.map((sl) => sl.sessionId);
    const isLinkedToSession = linkedSessionIds.length > 0;

    if (isLinkedToSession) {
      const attendance = await prisma.attendance.findFirst({
        where: {
          studentId,
          sessionId: { in: linkedSessionIds },
          status: AttendanceStatus.PRESENT
        }
      });

      if (!attendance) {
        return {
          id: lesson.id,
          curriculumId: lesson.curriculumId,
          curriculum: lesson.curriculum,
          title: lesson.title,
          description: lesson.description,
          content: null, // Locked - content hidden
          difficulty: lesson.difficulty,
          estimatedDurationMinutes: lesson.estimatedDurationMinutes,
          order: lesson.order,
          isPublished: lesson.isPublished,
          isLocked: true,
          lockReason: 'ATTENDANCE_REQUIRED',
          tasks: []
        };
      }
    }
  }

  return {
    ...lesson,
    isLocked: false,
    lockReason: null
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

  const updated = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      curriculumId: input.curriculumId,
      title: input.title,
      description: input.description !== undefined ? input.description : undefined,
      content: input.content,
      difficulty: input.difficulty,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      order: input.order,
      isPublished: input.isPublished,
      externalResourceUrl: input.externalResourceUrl !== undefined ? (input.externalResourceUrl || null) : undefined,
      externalResourceTitle: input.externalResourceTitle !== undefined ? (input.externalResourceTitle || null) : undefined
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
