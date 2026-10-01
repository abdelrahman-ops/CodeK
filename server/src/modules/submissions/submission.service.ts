import { prisma } from '../../db/prisma.js';
import { CreateSubmissionInput, ListSubmissionsQuery, ReviewSubmissionInput } from './submission.schema.js';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { NotificationType, SubmissionStatus, XPSourceType } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service.js';
import { createNotification } from '../notifications/notification.service.js';
import { assertGradeAccess } from '../curriculum/curriculum-auth.js';

export async function submitTask(studentUserId: string, input: CreateSubmissionInput) {
  const student = await prisma.student.findUnique({
    where: { userId: studentUserId }
  });

  if (!student) {
    throw new NotFoundError('Student profile not found');
  }

  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
    include: {
      lesson: {
        include: {
          curriculum: true
        }
      }
    }
  });

  if (!task || !task.isPublished) {
    throw new NotFoundError('Task not found or not published');
  }

  if (!task.lesson?.curriculum?.grade) {
    throw new NotFoundError('Task not found');
  }

  assertGradeAccess(student.grade, task.lesson.curriculum.grade, 'Task');

  const submission = await prisma.submission.upsert({
    where: {
      taskId_studentId: {
        taskId: input.taskId,
        studentId: student.id
      }
    },
    create: {
      taskId: input.taskId,
      studentId: student.id,
      content: input.content || null,
      fileUrl: input.fileUrl && input.fileUrl.trim() !== '' ? input.fileUrl : null,
      githubUrl: input.githubUrl && input.githubUrl.trim() !== '' ? input.githubUrl : null,
      status: SubmissionStatus.PENDING,
      submittedAt: new Date()
    },
    update: {
      content: input.content || null,
      fileUrl: input.fileUrl && input.fileUrl.trim() !== '' ? input.fileUrl : null,
      githubUrl: input.githubUrl && input.githubUrl.trim() !== '' ? input.githubUrl : null,
      status: SubmissionStatus.PENDING,
      submittedAt: new Date(),
      feedback: null
    }
  });

  await createAuditLog({
    actorUserId: studentUserId,
    action: 'TASK_SUBMITTED',
    entityType: 'Submission',
    entityId: submission.id,
    metadata: { taskId: input.taskId, studentId: student.id }
  });

  return submission;
}

export async function reviewSubmission(
  submissionId: string,
  input: ReviewSubmissionInput,
  actorUserId?: string
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      task: true,
      student: { include: { user: true } }
    }
  });

  if (!submission) {
    throw new NotFoundError('Submission not found');
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: input.status,
        feedback: input.feedback || null,
        reviewedAt: new Date()
      }
    });

    let xpAwarded = false;
    if (input.status === SubmissionStatus.APPROVED) {
      // Check if XP already awarded for this task
      const existingXP = await tx.xPTransaction.findUnique({
        where: {
          studentId_sourceType_sourceId: {
            studentId: submission.studentId,
            sourceType: XPSourceType.TASK,
            sourceId: submission.taskId
          }
        }
      });

      if (!existingXP) {
        await tx.xPTransaction.create({
          data: {
            studentId: submission.studentId,
            amount: submission.task.xpReward,
            reason: `Task: ${submission.task.title}`,
            sourceType: XPSourceType.TASK,
            sourceId: submission.taskId
          }
        });

        await tx.student.update({
          where: { id: submission.studentId },
          data: {
            totalXp: { increment: submission.task.xpReward },
            lastActiveDate: new Date()
          }
        });
        xpAwarded = true;
      }
    }

    return { updated, xpAwarded };
  });

  const notifTitle = input.status === SubmissionStatus.APPROVED
    ? 'Task Approved'
    : input.status === SubmissionStatus.NEEDS_REVISION
    ? 'Revision Requested'
    : 'Task Reviewed';

  const notifMsg = input.status === SubmissionStatus.APPROVED
    ? `Great job! Your submission for "${submission.task.title}" was approved (+${submission.task.xpReward} XP).`
    : `Your submission for "${submission.task.title}" was reviewed. Feedback: ${input.feedback || 'Please check remarks.'}`;

  await createNotification({
    userId: submission.student.userId,
    title: notifTitle,
    message: notifMsg,
    type: NotificationType.TASK_REVIEWED
  });

  await createAuditLog({
    actorUserId,
    action: 'SUBMISSION_REVIEWED',
    entityType: 'Submission',
    entityId: submissionId,
    metadata: {
      taskId: submission.taskId,
      studentId: submission.studentId,
      status: input.status,
      xpAwarded: result.xpAwarded ? submission.task.xpReward : 0
    }
  });

  return result.updated;
}

export async function listSubmissions(query: ListSubmissionsQuery) {
  const { taskId, studentId, status, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(taskId ? { taskId } : {}),
    ...(studentId ? { studentId } : {}),
    ...(status ? { status } : {})
  };

  const [total, items] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      skip,
      take: limit,
      orderBy: { submittedAt: 'desc' },
      include: {
        task: { select: { id: true, title: true, xpReward: true, taskType: true } },
        student: {
          include: {
            user: {
              select: {
                id: true,
                loginId: true,
                firstName: true,
                lastName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    })
  ]);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}
