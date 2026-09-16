import { prisma } from '../../db/prisma.js';
import { AssignTaskInput, CreateTaskInput, ListTasksQuery, UpdateTaskInput } from './task.schema.js';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { NotificationType, Role, StudentGrade } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service.js';
import { createBulkNotifications } from '../notifications/notification.service.js';
import { getStudentGrade, assertGradeAccess } from '../curriculum/curriculum-auth.js';

export async function createTask(input: CreateTaskInput, actorUserId?: string) {
  const task = await prisma.task.create({
    data: {
      lessonId: input.lessonId || null,
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      taskType: input.taskType,
      difficulty: input.difficulty,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      xpReward: input.xpReward,
      isPublished: input.isPublished,
      assignments: input.groupIds && input.groupIds.length > 0
        ? {
            create: input.groupIds.map((groupId) => ({
              groupId,
              dueDate: input.dueDate ? new Date(input.dueDate) : null
            }))
          }
        : undefined
    },
    include: {
      lesson: true,
      assignments: { include: { group: true } }
    }
  });

  if (input.groupIds && input.groupIds.length > 0) {
    const enrollments = await prisma.groupEnrollment.findMany({
      where: { groupId: { in: input.groupIds }, isActive: true },
      include: { student: true }
    });

    const userIds = enrollments.map((e) => e.student.userId);
    await createBulkNotifications(
      userIds,
      'New Task Assigned',
      `"${task.title}" is now available for your group (+${task.xpReward} XP).`,
      NotificationType.TASK_ASSIGNED
    );
  }

  await createAuditLog({
    actorUserId,
    action: 'TASK_CREATED',
    entityType: 'Task',
    entityId: task.id,
    metadata: { title: task.title, type: task.taskType, xpReward: task.xpReward }
  });

  return task;
}

export async function assignTaskToGroup(
  taskId: string,
  input: AssignTaskInput,
  actorUserId?: string
) {
  const [task, group] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId } }),
    prisma.group.findUnique({ where: { id: input.groupId } })
  ]);

  if (!task) throw new NotFoundError('Task not found');
  if (!group) throw new NotFoundError('Group not found');

  const assignment = await prisma.taskAssignment.upsert({
    where: {
      taskId_groupId: {
        taskId,
        groupId: input.groupId
      }
    },
    create: {
      taskId,
      groupId: input.groupId,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined
    },
    update: {
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined
    }
  });

  const enrollments = await prisma.groupEnrollment.findMany({
    where: { groupId: input.groupId, isActive: true },
    include: { student: true }
  });

  const userIds = enrollments.map((e) => e.student.userId);
  await createBulkNotifications(
    userIds,
    'New Task Assigned',
    `"${task.title}" is now assigned to your group (+${task.xpReward} XP).`,
    NotificationType.TASK_ASSIGNED
  );

  await createAuditLog({
    actorUserId,
    action: 'TASK_ASSIGNED_TO_GROUP',
    entityType: 'TaskAssignment',
    entityId: assignment.id,
    metadata: { taskId, groupId: input.groupId }
  });

  return assignment;
}

export async function listTasks(query: ListTasksQuery, user: { userId: string; role: Role; studentId?: string }) {
  const { lessonId, groupId, taskType, difficulty, isPublished } = query;

  let where: any = {
    ...(lessonId ? { lessonId } : {}),
    ...(taskType ? { taskType } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(isPublished !== undefined ? { isPublished } : {})
  };

  if (user.role === Role.STUDENT && user.studentId) {
    const studentGrade = await getStudentGrade(user.studentId);
    if (!studentGrade) {
      return [];
    }

    where.isPublished = true;
    where.lesson = {
      curriculum: {
        grade: studentGrade
      }
    };

    if (groupId) {
      where.assignments = { some: { groupId } };
    }
  } else if (groupId) {
    where.assignments = { some: { groupId } };
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          curriculum: { select: { id: true, title: true, grade: true } }
        }
      },
      assignments: { include: { group: { select: { id: true, name: true } } } },
      submissions: user.studentId
        ? {
            where: { studentId: user.studentId }
          }
        : false
    }
  });

  return tasks;
}

export async function getTaskById(taskId: string, user: { userId: string; role: Role; studentId?: string }) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      lesson: {
        include: {
          curriculum: true
        }
      },
      assignments: { include: { group: true } },
      submissions: user.role === Role.STUDENT && user.studentId
        ? {
            where: { studentId: user.studentId }
          }
        : user.role === Role.ADMIN
        ? {
            include: {
              student: {
                include: {
                  user: { select: { firstName: true, lastName: true, avatarUrl: true } }
                }
              }
            }
          }
        : false
    }
  });

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  if (user.role === Role.STUDENT && user.studentId) {
    if (!task.lesson?.curriculum?.grade) {
      throw new NotFoundError('Task not found');
    }
    const studentGrade = await getStudentGrade(user.studentId);
    assertGradeAccess(studentGrade, task.lesson.curriculum.grade, 'Task');
  }

  return task;
}

export async function updateTask(taskId: string, input: UpdateTaskInput, actorUserId?: string) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new NotFoundError('Task not found');

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      lessonId: input.lessonId !== undefined ? input.lessonId : undefined,
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      taskType: input.taskType,
      difficulty: input.difficulty,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      xpReward: input.xpReward,
      isPublished: input.isPublished
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'TASK_UPDATED',
    entityType: 'Task',
    entityId: taskId,
    metadata: { changed: input }
  });

  return updated;
}

export async function deleteTask(taskId: string, actorUserId?: string) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      _count: {
        select: { submissions: true }
      }
    }
  });
  if (!existing) throw new NotFoundError('Task not found');

  if (existing._count.submissions > 0) {
    throw new BadRequestError('Cannot delete task with existing student submissions. Unpublish or deactivate the task instead.');
  }

  await prisma.task.delete({ where: { id: taskId } });

  await createAuditLog({
    actorUserId,
    action: 'TASK_DELETED',
    entityType: 'Task',
    entityId: taskId,
    metadata: { title: existing.title }
  });

  return { success: true };
}

export async function bulkPublishTasks(
  ids: string[],
  isPublished: boolean,
  actorUserId?: string
) {
  const result = await prisma.task.updateMany({
    where: { id: { in: ids } },
    data: { isPublished }
  });

  await createAuditLog({
    actorUserId,
    action: isPublished ? 'TASKS_BULK_PUBLISHED' : 'TASKS_BULK_UNPUBLISHED',
    entityType: 'Task',
    entityId: ids[0] || null,
    metadata: { count: result.count, ids, isPublished }
  });

  return {
    success: true,
    count: result.count,
    ids
  };
}

export async function bulkDeleteTasks(
  ids: string[],
  actorUserId?: string
) {
  const successful: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const id of ids) {
    try {
      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          _count: { select: { submissions: true } }
        }
      });

      if (!task) {
        failed.push({ id, reason: 'Task not found' });
        continue;
      }

      if (task._count.submissions > 0) {
        failed.push({
          id,
          reason: `Cannot delete task "${task.title}" because it has ${task._count.submissions} student submissions. Unpublish instead.`
        });
        continue;
      }

      await prisma.task.delete({ where: { id } });
      successful.push(id);
    } catch (err: any) {
      failed.push({ id, reason: err.message || 'Deletion failed' });
    }
  }

  await createAuditLog({
    actorUserId,
    action: 'TASKS_BULK_DELETED',
    entityType: 'Task',
    entityId: ids[0] || null,
    metadata: { successfulCount: successful.length, failedCount: failed.length }
  });

  return {
    success: failed.length === 0,
    successful,
    failed
  };
}
