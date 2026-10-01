import { prisma } from '../../db/prisma.js';
import { UpdateLessonProgressInput } from './progress.schema.js';
import { LessonProgressStatus, XPSourceType } from '@prisma/client';
import { NotFoundError } from '../../common/errors/app-error.js';
import { getStudentGrade, assertGradeAccess } from '../curriculum/curriculum-auth.js';

export async function getStudentLessonProgress(studentId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { curriculum: true }
  });
  if (!lesson) {
    throw new NotFoundError('Lesson not found');
  }

  const studentGrade = await getStudentGrade(studentId);
  assertGradeAccess(studentGrade, lesson.curriculum.grade, 'Lesson');

  const progress = await prisma.studentLessonProgress.findUnique({
    where: {
      studentId_lessonId: {
        studentId,
        lessonId
      }
    }
  });

  if (!progress) {
    return {
      lessonId,
      studentId,
      status: LessonProgressStatus.NOT_STARTED,
      progressPercentage: 0,
      lastWatchedPosition: 0,
      startedAt: null,
      completedAt: null
    };
  }

  return progress;
}

export async function updateStudentLessonProgress(
  studentId: string,
  lessonId: string,
  input: UpdateLessonProgressInput
) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { curriculum: true }
  });
  if (!lesson) {
    throw new NotFoundError('Lesson not found');
  }

  const studentGrade = await getStudentGrade(studentId);
  assertGradeAccess(studentGrade, lesson.curriculum.grade, 'Lesson');

  const now = new Date();
  const isMarkingCompleted = input.completed === true || input.status === LessonProgressStatus.COMPLETED;

  let targetStatus: LessonProgressStatus = input.status || LessonProgressStatus.IN_PROGRESS;
  let targetPercentage: number = input.progressPercentage !== undefined ? input.progressPercentage : 0;

  if (isMarkingCompleted) {
    targetStatus = LessonProgressStatus.COMPLETED;
    targetPercentage = 100;
  } else if (input.progressPercentage !== undefined) {
    if (input.progressPercentage === 100) {
      targetStatus = LessonProgressStatus.COMPLETED;
    } else if (input.progressPercentage > 0) {
      targetStatus = LessonProgressStatus.IN_PROGRESS;
    }
  }

  const progress = await prisma.studentLessonProgress.upsert({
    where: {
      studentId_lessonId: {
        studentId,
        lessonId
      }
    },
    create: {
      studentId,
      lessonId,
      status: targetStatus,
      progressPercentage: targetPercentage,
      lastWatchedPosition: input.lastWatchedPosition ?? 0,
      startedAt: now,
      completedAt: isMarkingCompleted ? now : null
    },
    update: {
      status: targetStatus,
      progressPercentage: targetPercentage,
      ...(input.lastWatchedPosition !== undefined ? { lastWatchedPosition: input.lastWatchedPosition } : {}),
      ...(isMarkingCompleted ? { completedAt: now } : {})
    }
  });

  // Award XP and check achievements upon first lesson completion
  if (progress.status === LessonProgressStatus.COMPLETED) {
    try {
      const existingXP = await prisma.xPTransaction.findUnique({
        where: {
          studentId_sourceType_sourceId: {
            studentId,
            sourceType: XPSourceType.LESSON,
            sourceId: lessonId
          }
        }
      });

      if (!existingXP) {
        await prisma.$transaction(async (tx) => {
          await tx.xPTransaction.create({
            data: {
              studentId,
              amount: 15,
              reason: `Completed Lesson: ${lesson.title}`,
              sourceType: XPSourceType.LESSON,
              sourceId: lessonId
            }
          });

          await tx.student.update({
            where: { id: studentId },
            data: {
              totalXp: { increment: 15 },
              lastActiveDate: now
            }
          });

          // Check if FIRST_LESSON_COMPLETED achievement exists
          const firstLessonAch = await tx.achievement.findUnique({
            where: { code: 'FIRST_LESSON_COMPLETED' }
          });
          if (firstLessonAch) {
            const alreadyUnlocked = await tx.studentAchievement.findUnique({
              where: {
                studentId_achievementId: {
                  studentId,
                  achievementId: firstLessonAch.id
                }
              }
            });
            if (!alreadyUnlocked) {
              await tx.studentAchievement.create({
                data: {
                  studentId,
                  achievementId: firstLessonAch.id
                }
              });
              if (firstLessonAch.xpReward > 0) {
                await tx.xPTransaction.create({
                  data: {
                    studentId,
                    amount: firstLessonAch.xpReward,
                    reason: `Achievement: ${firstLessonAch.name}`,
                    sourceType: XPSourceType.ACHIEVEMENT,
                    sourceId: firstLessonAch.id
                  }
                });
                await tx.student.update({
                  where: { id: studentId },
                  data: { totalXp: { increment: firstLessonAch.xpReward } }
                });
              }
            }
          }
        });
      }
    } catch {
      // Non-blocking for progress return
    }
  }

  return progress;
}

export async function getCourseProgress(curriculumId: string, studentId: string) {
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    include: {
      lessons: {
        where: { isPublished: true },
        select: { id: true }
      }
    }
  });

  if (!curriculum) {
    throw new NotFoundError('Curriculum / Course not found');
  }

  const studentGrade = await getStudentGrade(studentId);
  assertGradeAccess(studentGrade, curriculum.grade, 'Curriculum');

  const totalLessons = curriculum.lessons.length;
  if (totalLessons === 0) {
    return {
      curriculumId,
      totalLessons: 0,
      completedLessons: 0,
      percentage: 0,
      status: LessonProgressStatus.NOT_STARTED
    };
  }

  const lessonIds = curriculum.lessons.map((l) => l.id);

  const completedCount = await prisma.studentLessonProgress.count({
    where: {
      studentId,
      lessonId: { in: lessonIds },
      status: LessonProgressStatus.COMPLETED
    }
  });

  const percentage = Math.round((completedCount / totalLessons) * 100);

  let status: LessonProgressStatus = LessonProgressStatus.NOT_STARTED;
  if (percentage === 100) {
    status = LessonProgressStatus.COMPLETED;
  } else if (completedCount > 0) {
    status = LessonProgressStatus.IN_PROGRESS;
  }

  return {
    curriculumId,
    totalLessons,
    completedLessons: completedCount,
    percentage,
    status
  };
}
