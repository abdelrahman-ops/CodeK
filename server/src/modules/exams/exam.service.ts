import { prisma } from '../../db/prisma.js';
import {
  CreateExamInput,
  CreateExamQuestionInput,
  ListExamsQuery,
  SubmitExamAttemptInput,
  UpdateExamInput
} from './exam.schema.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';
import { NotificationType, QuestionType, Role, XPSourceType } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service.js';
import { createNotification } from '../notifications/notification.service.js';
import { getStudentGrade, assertGradeAccess } from '../curriculum/curriculum-auth.js';

export async function createExam(input: CreateExamInput, actorUserId?: string) {
  let curriculumId = input.curriculumId || null;

  if (input.lessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: input.lessonId },
      select: { id: true, curriculumId: true }
    });
    if (!lesson) throw new NotFoundError('Lesson not found');
    if (curriculumId && curriculumId !== lesson.curriculumId) {
      throw new BadRequestError('Conflicting curriculumId and lessonId: lesson belongs to a different curriculum');
    }
    curriculumId = lesson.curriculumId;
  }

  const exam = await prisma.exam.create({
    data: {
      title: input.title,
      description: input.description,
      curriculumId,
      groupId: input.groupId || null,
      lessonId: input.lessonId || null,
      isQuiz: input.isQuiz ?? false,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      durationMinutes: input.durationMinutes,
      totalMarks: input.totalMarks,
      xpReward: input.xpReward,
      isPublished: input.isPublished
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'EXAM_CREATED',
    entityType: 'Exam',
    entityId: exam.id,
    metadata: { title: exam.title, totalMarks: exam.totalMarks }
  });

  return exam;
}

export async function addExamQuestion(
  examId: string,
  input: CreateExamQuestionInput,
  actorUserId?: string
) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new NotFoundError('Exam not found');

  const question = await prisma.examQuestion.create({
    data: {
      examId,
      questionText: input.questionText,
      questionType: input.questionType,
      options: input.options ? JSON.stringify(input.options) : null,
      correctAnswer: input.correctAnswer,
      marks: input.marks,
      order: input.order
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'EXAM_QUESTION_ADDED',
    entityType: 'ExamQuestion',
    entityId: question.id,
    metadata: { examId }
  });

  return question;
}

export async function listExams(
  query: ListExamsQuery,
  requestUser: { userId: string; role: Role; studentId?: string }
) {
  if (requestUser.role === Role.ADMIN) {
    const where = {
      ...(query.curriculumId ? { curriculumId: query.curriculumId } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.lessonId ? { lessonId: query.lessonId } : {}),
      ...(query.isQuiz !== undefined ? { isQuiz: query.isQuiz } : {}),
      ...(query.grade ? { curriculum: { grade: query.grade } } : {})
    };

    return prisma.exam.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      include: {
        curriculum: { select: { id: true, title: true, grade: true } },
        lesson: { select: { id: true, title: true } },
        group: { select: { id: true, name: true } },
        _count: { select: { questions: true, attempts: true } }
      }
    });
  }

  // If Student
  if (requestUser.role === Role.STUDENT && requestUser.studentId) {
    const studentGrade = await getStudentGrade(requestUser.studentId);
    if (!studentGrade) {
      return [];
    }

    const enrollment = await prisma.groupEnrollment.findFirst({
      where: { studentId: requestUser.studentId, isActive: true }
    });

    const studentGroupId = enrollment?.groupId;

    const exams = await prisma.exam.findMany({
      where: {
        isPublished: true,
        curriculum: { grade: studentGrade },
        ...(query.lessonId ? { lessonId: query.lessonId } : {}),
        ...(query.curriculumId ? { curriculumId: query.curriculumId } : {}),
        ...(query.isQuiz !== undefined ? { isQuiz: query.isQuiz } : {}),
        OR: [
          { groupId: null }, // Open to all groups
          ...(studentGroupId ? [{ groupId: studentGroupId }] : [])
        ]
      },
      orderBy: { startsAt: 'desc' },
      include: {
        curriculum: { select: { id: true, title: true, grade: true } },
        lesson: { select: { id: true, title: true } },
        _count: { select: { questions: true } },
        attempts: {
          where: { studentId: requestUser.studentId }
        }
      }
    });

    return exams.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      curriculum: e.curriculum,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      durationMinutes: e.durationMinutes,
      totalMarks: e.totalMarks,
      xpReward: e.xpReward,
      questionCount: e._count.questions,
      myAttempt: e.attempts[0] || null
    }));
  }

  return [];
}

export async function getExamForStudent(
  examId: string,
  requestUser: { userId: string; role: Role; studentId?: string }
) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      curriculum: true,
      lesson: {
        include: { curriculum: true }
      },
      questions: {
        orderBy: { order: 'asc' }
      },
      attempts: requestUser.role === Role.STUDENT && requestUser.studentId
        ? { where: { studentId: requestUser.studentId } }
        : false
    }
  });

  if (!exam) throw new NotFoundError('Exam not found');

  if (requestUser.role === Role.ADMIN) {
    return exam;
  }

  // Student Grade Isolation: mismatch throws 404
  if (requestUser.role === Role.STUDENT && requestUser.studentId) {
    const studentGrade = await getStudentGrade(requestUser.studentId);
    const examGrade = exam.curriculum?.grade || exam.lesson?.curriculum?.grade;
    if (!examGrade) {
      throw new NotFoundError('Exam not found');
    }
    assertGradeAccess(studentGrade, examGrade, 'Exam');
  }

  // Student Access Restrictions
  if (!exam.isPublished) {
    throw new NotFoundError('Exam not found or not published');
  }

  // Group restriction check
  if (exam.groupId && requestUser.studentId) {
    const isEnrolled = await prisma.groupEnrollment.findFirst({
      where: {
        groupId: exam.groupId,
        studentId: requestUser.studentId,
        isActive: true
      }
    });

    if (!isEnrolled) {
      throw new ForbiddenError('You are not enrolled in the class group assigned to this exam');
    }
  }

  // Timing check (exams only; quizzes are self-paced)
  const now = new Date();
  const hasAttempted = Boolean((exam as any).attempts?.[0]);
  if (!exam.isQuiz && now < exam.startsAt && !hasAttempted) {
    throw new BadRequestError('This exam has not started yet');
  }

  // Sanitize questions for student (strictly hide correctAnswer)
  const sanitizedQuestions = exam.questions.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options ? JSON.parse(q.options) : [],
    marks: q.marks,
    order: q.order
  }));

  return {
    id: exam.id,
    code: exam.code,
    title: exam.title,
    description: exam.description,
    isQuiz: exam.isQuiz,
    authority: exam.authority,
    curriculum: exam.curriculum,
    startsAt: exam.startsAt,
    endsAt: exam.endsAt,
    durationMinutes: exam.durationMinutes,
    totalMarks: exam.totalMarks,
    xpReward: exam.xpReward,
    questions: sanitizedQuestions,
    myAttempt: (exam as any).attempts?.[0] || null
  };
}

export async function submitExamAttempt(
  studentUserId: string,
  examId: string,
  input: SubmitExamAttemptInput
) {
  const student = await prisma.student.findUnique({
    where: { userId: studentUserId }
  });

  if (!student) throw new NotFoundError('Student not found');

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      curriculum: true,
      lesson: {
        include: { curriculum: true }
      },
      questions: true
    }
  });

  if (!exam || !exam.isPublished) {
    throw new NotFoundError('Exam not found or not available');
  }

  // Grade Isolation: mismatch throws 404
  const examGrade = exam.curriculum?.grade || exam.lesson?.curriculum?.grade;
  if (!examGrade) {
    throw new NotFoundError('Exam not found or not available');
  }
  assertGradeAccess(student.grade, examGrade, 'Exam');

  // Group enrollment check
  if (exam.groupId) {
    const isEnrolled = await prisma.groupEnrollment.findFirst({
      where: {
        groupId: exam.groupId,
        studentId: student.id,
        isActive: true
      }
    });

    if (!isEnrolled) {
      throw new ForbiddenError('You are not enrolled in the class group assigned to this exam');
    }
  }

  // Timing check (exams only; quizzes are self-paced)
  const now = new Date();
  if (!exam.isQuiz) {
    if (now < exam.startsAt) {
      throw new BadRequestError('This exam has not started yet');
    }
    if (now > exam.endsAt) {
      throw new BadRequestError('Exam submission deadline has passed. Submissions are closed.');
    }
  }

  const existingAttempt = await prisma.examAttempt.findUnique({
    where: {
      examId_studentId: {
        examId,
        studentId: student.id
      }
    }
  });

  if (existingAttempt) {
    throw new BadRequestError('You have already submitted an attempt for this exam');
  }

  // Automatic Grading for Multiple Choice Questions
  let earnedMarks = 0;
  for (const q of exam.questions) {
    const studentAnswer = input.answers[q.id];
    if (studentAnswer !== undefined && q.correctAnswer) {
      if (studentAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
        earnedMarks += q.marks;
      }
    }
  }

  const percentage = exam.totalMarks > 0 ? Number(((earnedMarks / exam.totalMarks) * 100).toFixed(1)) : 0;
  // Calculate proportional XP earned
  const xpEarned = Math.round((percentage / 100) * exam.xpReward);

  const result = await prisma.$transaction(async (tx) => {
    const attempt = await tx.examAttempt.create({
      data: {
        examId,
        studentId: student.id,
        answers: JSON.stringify(input.answers),
        score: earnedMarks,
        percentage,
        xpEarned
      }
    });

    if (xpEarned > 0) {
      await tx.xPTransaction.create({
        data: {
          studentId: student.id,
          amount: xpEarned,
          reason: `${exam.isQuiz ? 'Quiz' : 'Exam'}: ${exam.title} (${percentage}%)`,
          sourceType: exam.isQuiz ? XPSourceType.QUIZ : XPSourceType.EXAM,
          sourceId: attempt.id
        }
      });

      await tx.student.update({
        where: { id: student.id },
        data: {
          totalXp: { increment: xpEarned },
          lastActiveDate: new Date()
        }
      });
    }

    // Award EXAM_ACE achievement if percentage >= 90
    if (percentage >= 90) {
      const examAceAch = await tx.achievement.findUnique({ where: { code: 'EXAM_ACE' } });
      if (examAceAch) {
        const alreadyHas = await tx.studentAchievement.findUnique({
          where: {
            studentId_achievementId: {
              studentId: student.id,
              achievementId: examAceAch.id
            }
          }
        });
        if (!alreadyHas) {
          await tx.studentAchievement.create({
            data: { studentId: student.id, achievementId: examAceAch.id }
          });
          if (examAceAch.xpReward > 0) {
            await tx.xPTransaction.create({
              data: {
                studentId: student.id,
                amount: examAceAch.xpReward,
                reason: `Achievement: ${examAceAch.name}`,
                sourceType: XPSourceType.ACHIEVEMENT,
                sourceId: examAceAch.id
              }
            });
            await tx.student.update({
              where: { id: student.id },
              data: { totalXp: { increment: examAceAch.xpReward } }
            });
          }
        }
      }
    }

    return attempt;
  });

  await createNotification({
    userId: studentUserId,
    title: 'Exam Completed',
    message: `You scored ${earnedMarks}/${exam.totalMarks} (${percentage}%) on "${exam.title}" (+${xpEarned} XP).`,
    type: NotificationType.EXAM_RESULT
  });

  await createAuditLog({
    actorUserId: studentUserId,
    action: 'EXAM_ATTEMPT_SUBMITTED',
    entityType: 'ExamAttempt',
    entityId: result.id,
    metadata: { examId, score: earnedMarks, percentage, xpEarned }
  });

  return {
    attempt: result,
    score: earnedMarks,
    totalMarks: exam.totalMarks,
    percentage,
    xpEarned
  };
}

export async function updateExam(
  examId: string,
  input: UpdateExamInput,
  actorUserId?: string
) {
  const existing = await prisma.exam.findUnique({ where: { id: examId } });
  if (!existing) throw new NotFoundError('Exam not found');

  let targetCurriculumId = input.curriculumId !== undefined ? input.curriculumId : existing.curriculumId;
  const targetLessonId = input.lessonId !== undefined ? (input.lessonId || null) : existing.lessonId;

  if (targetLessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: targetLessonId },
      select: { id: true, curriculumId: true }
    });
    if (!lesson) throw new NotFoundError('Lesson not found');
    if (targetCurriculumId && targetCurriculumId !== lesson.curriculumId) {
      throw new BadRequestError('Conflicting curriculumId and lessonId: lesson belongs to a different curriculum');
    }
    targetCurriculumId = lesson.curriculumId;
  }

  const updated = await prisma.exam.update({
    where: { id: examId },
    data: {
      title: input.title,
      description: input.description !== undefined ? input.description : undefined,
      curriculumId: targetCurriculumId !== undefined ? targetCurriculumId : undefined,
      groupId: input.groupId !== undefined ? input.groupId : undefined,
      lessonId: targetLessonId !== undefined ? targetLessonId : undefined,
      isQuiz: input.isQuiz !== undefined ? input.isQuiz : undefined,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      durationMinutes: input.durationMinutes,
      totalMarks: input.totalMarks,
      xpReward: input.xpReward,
      isPublished: input.isPublished
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'EXAM_UPDATED',
    entityType: 'Exam',
    entityId: examId,
    metadata: { changed: input }
  });

  return updated;
}

export async function deleteExam(examId: string, actorUserId?: string) {
  const existing = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      _count: { select: { attempts: true } }
    }
  });
  if (!existing) throw new NotFoundError('Exam not found');

  if (existing._count.attempts > 0) {
    throw new BadRequestError('Cannot delete exam with existing student attempt records. Unpublish the exam instead.');
  }

  await prisma.exam.delete({ where: { id: examId } });

  await createAuditLog({
    actorUserId,
    action: 'EXAM_DELETED',
    entityType: 'Exam',
    entityId: examId,
    metadata: { title: existing.title }
  });

  return { success: true };
}

export async function deleteExamQuestion(examId: string, questionId: string, actorUserId?: string) {
  const question = await prisma.examQuestion.findFirst({
    where: { id: questionId, examId }
  });
  if (!question) throw new NotFoundError('Question not found');

  await prisma.examQuestion.delete({ where: { id: questionId } });

  await createAuditLog({
    actorUserId,
    action: 'EXAM_QUESTION_DELETED',
    entityType: 'ExamQuestion',
    entityId: questionId,
    metadata: { examId }
  });

  return { success: true };
}

export async function getExamAttempts(examId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new NotFoundError('Exam not found');

  const attempts = await prisma.examAttempt.findMany({
    where: { examId },
    orderBy: { score: 'desc' },
    include: {
      student: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatarUrl: true,
              email: true,
              phone: true
            }
          }
        }
      }
    }
  });

  return {
    examId,
    examTitle: exam.title,
    totalMarks: exam.totalMarks,
    attempts: attempts.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentCode: a.student.studentCode,
      studentName: `${a.student.user.firstName} ${a.student.user.lastName}`,
      avatarUrl: a.student.user.avatarUrl,
      score: a.score,
      percentage: a.percentage,
      xpEarned: a.xpEarned,
      submittedAt: a.submittedAt
    }))
  };
}

export async function bulkPublishExams(
  ids: string[],
  isPublished: boolean,
  actorUserId?: string
) {
  const result = await prisma.exam.updateMany({
    where: { id: { in: ids } },
    data: { isPublished }
  });

  await createAuditLog({
    actorUserId,
    action: isPublished ? 'EXAMS_BULK_PUBLISHED' : 'EXAMS_BULK_UNPUBLISHED',
    entityType: 'Exam',
    entityId: ids[0] || null,
    metadata: { count: result.count, ids, isPublished }
  });

  return {
    success: true,
    count: result.count,
    ids
  };
}

export async function bulkDeleteExams(
  ids: string[],
  actorUserId?: string
) {
  const successful: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const id of ids) {
    try {
      const exam = await prisma.exam.findUnique({
        where: { id },
        include: {
          _count: { select: { attempts: true } }
        }
      });

      if (!exam) {
        failed.push({ id, reason: 'Exam not found' });
        continue;
      }

      if (exam._count.attempts > 0) {
        failed.push({
          id,
          reason: `Cannot delete exam "${exam.title}" because it has ${exam._count.attempts} student attempt records. Unpublish instead.`
        });
        continue;
      }

      await prisma.exam.delete({ where: { id } });
      successful.push(id);
    } catch (err: any) {
      failed.push({ id, reason: err.message || 'Deletion failed' });
    }
  }

  await createAuditLog({
    actorUserId,
    action: 'EXAMS_BULK_DELETED',
    entityType: 'Exam',
    entityId: ids[0] || null,
    metadata: { successfulCount: successful.length, failedCount: failed.length }
  });

  return {
    success: failed.length === 0,
    successful,
    failed
  };
}
